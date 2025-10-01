import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client, SFTPWrapper, Stats, FileEntryWithStats } from 'ssh2';
import { DatabaseService } from '../../database/database.service';
import { currencies, currenciesRelations, currencyIndexes } from '../../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import * as mime from 'mime-types';
import axios from "axios";
import puppeteer from "puppeteer";
import * as fs from 'fs';
export const rootPath = '/uploads';
const addRootPath = (path: string) => rootPath + (path.startsWith('/') ? path : '/' + path);

interface CacData {
    period: string; // YYYY-MM format
}

interface UvaUviData {
    fecha: string; // DD-MM-YYYY format
    valor: number;
}

interface DolaritoData {
    [key: string]: number | undefined; // Mapea dates a valores
}
interface DolarAbsolutoData {
    date: string; // DD-MM-YYYY format
    valor: number;
}
interface InflationData {
    date: string; // DD-MM-YYYY format
    valor: number;
}
interface Currency {
    id: number;
    code: string;
    label: string;
    symbol: string;
}
const generateDateArrayUntilToday = (startDateStr: String, endDateStr = null) => {
    // Crear la date de inicio en UTC
    const startDate = new Date(Date.UTC(
        parseInt(startDateStr.split('-')[0]),  // Año
        parseInt(startDateStr.split('-')[1]) - 1,  // Mes (0-indexed)
        parseInt(startDateStr.split('-')[2])   // Día
    ));

    // Crear la date de hoy en UTC
    const today = (endDateStr ?
        new Date(Date.UTC(
            parseInt(endDateStr.split('-')[0]),  // Año
            parseInt(endDateStr.split('-')[1]) - 1,  // Mes (0-indexed)
            parseInt(endDateStr.split('-')[2])   // Día
        ))
        : new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate()
        )));

    const dateArray = [];

    for (let currentDate = new Date(startDate); currentDate <= today; currentDate.setUTCDate(currentDate.getUTCDate() + 1)) {
        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0'); // Mes en formato 'MM'
        const day = String(currentDate.getUTCDate()).padStart(2, '0'); // Día en formato 'DD'

        dateArray.push(`${year}-${month}-${day}`);
    }

    return dateArray;
};
async function getChromePath() {
    try {
        // Intenta varias rutas comunes de Chrome
        const possiblePaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/opt/google/chrome/google-chrome'
        ];

        for (const path of possiblePaths) {
            try {
                const fs = require('fs');
                if (fs.existsSync(path)) {
                    return path;
                }
            } catch (e) {
                // Continuar con la siguiente ruta
            }
        }

        // Si no encuentra ninguna, lanza error
        throw new Error('Chrome not found in any common paths');
    } catch (error) {
        console.error('Error finding Chrome:', error);
        throw error;
    }
}
@Injectable()
export class IndexesRepository {

    constructor(private readonly db: DatabaseService) { }

    async scrapeCPI(): Promise<{ date: string, value: number }[]> {
        // Configuración específica para Docker
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        try {
            const page = await browser.newPage();

            // Configurar timeout y user-agent
            await page.setDefaultNavigationTimeout(60000);
            await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');

            await page.goto("https://www.usinflationcalculator.com/inflation/consumer-price-index-and-annual-percent-changes-from-1913-to-2008/", {
                waitUntil: "networkidle2",
                timeout: 60000
            });

            // Esperar a que la tabla se cargue
            await page.waitForSelector('table', { timeout: 30000 });

            const inflationData: { date: string, value: number }[] = await page.evaluate(() => {
                const data: { date: string, value: number }[] = [];
                const table = document.querySelector("table");
                if (!table) return data;

                const rows = Array.from(table.querySelectorAll("tr"));
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];

                for (const row of rows) {
                    const cells = Array.from(row.querySelectorAll("td"));
                    if (cells.length < 13) continue;

                    const yearText = cells[0].textContent?.trim();
                    const year = parseInt(yearText ?? "");
                    if (isNaN(year) || year < 2000) continue;

                    for (let i = 1; i <= 12; i++) {
                        const month = months[i - 1];
                        const rawValue = cells[i].textContent?.trim().replace("–", "").replace(",", ".");
                        const value = parseFloat(rawValue ?? "");

                        if (!isNaN(value)) {
                            const paddedMonth = String(i).padStart(2, '0');
                            const date = `${paddedMonth}-${year}`;
                            data.push({ date, value });
                        }
                    }
                }

                return data;
            });

            // // Usar path absoluto para el archivo
            // const fs = require('fs');
            // const path = require('path');
            // fs.writeFileSync(path.join(__dirname, "inflationData.json"), JSON.stringify(inflationData, null, 2));

            //console.log(`Datos extraídos CPI: ${inflationData.length} registros`);
            return inflationData;

        } catch (error) {
            console.error('Error en scraping:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }

    async getAllIndexes() {
        return this.db.db.select().from(currencyIndexes);
    }
    async getIndexesByDate(date: string) {
        return this.db.db.select().from(currencyIndexes).where(eq(currencyIndexes.date, date));
    }
    async updateIndexes() {
        const getUpdatedIndexes = async () => {
            const endpoints = {
                inflationData: () => this.scrapeCPI(),
                cac: () => axios.get('https://prestamos.ikiwi.net.ar/api/cacs').then(r => r.data),
                uva: () => axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uva/valores/").then(r => r.data),
                uvi: () => axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uvi/valores/").then(r => r.data),
                dolares: () => fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares/").then(r => r.ok ? r.json() : Promise.reject("Fetch failed"))
            };
            const results = await Promise.allSettled([
                endpoints.inflationData(),
                endpoints.cac(),
                endpoints.uva(),
                endpoints.uvi(),
                endpoints.dolares()
            ]);

            const [datosInflation, datosCAC, datosUVA, datosUVI, datosDolares] = results.map((r, i) => {
                //console.log({ i, status: r.status });
                if (r.status === 'fulfilled') return r.value;

                const key = Object.keys(endpoints)[i];
                console.warn(`❌ Error al obtener "${key}":`, r.reason);
                return [];
            });
            const dolarMap = datosDolares.reduce((acc: any, x: { fecha: string; compra: number; venta: number; casa: string }) => {
                acc[x.fecha] ||= {};
                switch (x.casa) {
                    case 'blue':
                        acc[x.fecha].informal = { compra: x.compra, venta: x.venta };
                        break;
                    case 'oficial':
                        acc[x.fecha].oficial = { compra: x.compra, venta: x.venta };
                        break;
                    case 'bolsa':
                        acc[x.fecha].mep = { compra: x.compra, venta: x.venta };
                        break;
                    case 'mayorista':
                        acc[x.fecha].mayorista = { compra: x.compra, venta: x.venta };
                        break;
                    case 'tarjeta':
                        acc[x.fecha].tarjeta = { compra: x.compra, venta: x.venta };
                        break;
                    case 'cripto':
                        acc[x.fecha].cripto = { compra: x.compra, venta: x.venta };
                        break;
                    case 'contadoconliqui':
                        acc[x.fecha].contadoconliqui = { compra: x.compra, venta: x.venta };
                        break;
                    default:
                        break;
                }
                return acc;
            }, {});
            //            console.log({dolarMap})
            const datosCPI = datosInflation?.reduce((acc: DolarAbsolutoData[], curr: { date: string, value: number }, i, arr) => {

                acc.push({ date: curr.date, valor: curr.value });
                return acc;
            }, []);
            //fs.writeFileSync("datosDolarAbsoluto.json", JSON.stringify(datosCPI)); // lo guarda en un archivo
            //Here it has to be the data of the inflation
            const days = generateDateArrayUntilToday('2010-01-01');
            return days.map((d, i) => {

                const [year, month, day] = d.split('-');

                const cacIndex = datosCAC.find((x: CacData) => {
                    const [_year, _month] = x.period.split('-');
                    return _month === month && _year === year;
                });

                const uvaIndex = datosUVA.find((x: UvaUviData) => {
                    const [_day, _month, _year] = x.fecha.split('-');
                    return _day === day && _month === month && _year === year;
                });

                const uviIndex = datosUVI.find((x: UvaUviData) => {
                    const [_day, _month, _year] = x.fecha.split('-');
                    return _day === day && _month === month && _year === year;
                });

                const dolarAbsolutoIndex = datosCPI.find((x: DolarAbsolutoData) => {
                    const [_month, _year] = x.date.split('-');
                    return _month === month && _year === year;
                });
                return {
                    date: d,
                    ...dolarMap[d],
                    cac: cacIndex,
                    uva: uvaIndex?.valor,
                    uvi: uviIndex?.valor,
                    cpi: dolarAbsolutoIndex?.valor,
                }
            });
        };
        const syncToDatabase = async (
            currencies: { id: number; name?: string; symbol?: string; code?: string; label?: string }[],
            currenciesRelations: { id: number; dividendId: number; divisorId: number; op: 'direct' | 'inverse' | 'both'; source: string }[],
            dbIndexes: Array<{ id: number; date: string; currenciesRelationsId: number; value: number }>,
            updatedIndexes: Array<{ date: string;[key: string]: any }>
        ) => {
            console.log(`Entrando a updateIndexes`);
            const findCurrencyId = (code: string) => currencies.find(x => x.code === code)?.id ?? null;
            const findRelationId = (dividendId: number, divisorId: number) => currenciesRelations.find(x => x.dividendId === dividendId && divisorId === x.divisorId)?.id ?? null;
            //Currencies IDs
            const pesoId = findCurrencyId('peso');
            const cpiId = findCurrencyId('cpi');
            const cacId = findCurrencyId('cac');
            const uvaId = findCurrencyId('uva');
            const mepCompraId = findCurrencyId('dolar_mep_compra');
            const mepVentaId = findCurrencyId('dolar_mep_venta');
            const oficialCompraId = findCurrencyId('dolar_oficial_compra');
            const oficialVentaId = findCurrencyId('dolar_oficial_venta');
            const dolarBlueVentaId = findCurrencyId('dolar_blue_venta');
            const dolarBlueCompraId = findCurrencyId('dolar_blue_compra');
            const dolarCclCompraId = findCurrencyId('dolar_ccl_compra');
            const dolarCclVentaId = findCurrencyId('dolar_ccl_venta');
            const dolarMayoristaCompraId = findCurrencyId('dolar_mayorista_compra');
            const dolarMayoristaVentaId = findCurrencyId('dolar_mayorista_venta');
            const dolarCriptoCompraId = findCurrencyId('dolar_cripto_compra');
            const dolarCriptoVentaId = findCurrencyId('dolar_cripto_venta');
            const dolarTarjetaCompraId = findCurrencyId('dolar_tarjeta_compra');
            const dolarTarjetaVentaId = findCurrencyId('dolar_tarjeta_venta');
            //Relations IDs
            const relationPesoCPIId = findRelationId(cpiId, pesoId);
            const relationMepCPIId = findRelationId(cpiId, mepCompraId);
            const relationCACPesoId = findRelationId(pesoId, cacId);
            const relationUVAPesoId = findRelationId(pesoId, uvaId);
            const relationDolarLibreCompraPesoId = findRelationId(pesoId, dolarBlueCompraId);
            const relationDolarLibreVentaPesoId = findRelationId(pesoId, dolarBlueVentaId);
            const relationDolarMepCompraPesoId = findRelationId(pesoId, mepCompraId);
            const relationDolarMepVentaPesoId = findRelationId(pesoId, mepVentaId);
            const relationDolarOficialCompraPesoId = findRelationId(pesoId, oficialCompraId);
            const relationDolarOficialVentaPesoId = findRelationId(pesoId, oficialVentaId);
            const relationDolarCclCompraPesoId = findRelationId(pesoId, dolarCclCompraId);
            const relationDolarCclVentaPesoId = findRelationId(pesoId, dolarCclVentaId);
            const relationDolarMayoristaCompraPesoId = findRelationId(pesoId, dolarMayoristaCompraId);
            const relationDolarMayoristaVentaPesoId = findRelationId(pesoId, dolarMayoristaVentaId);
            const relationDolarCriptoCompraPesoId = findRelationId(pesoId, dolarCriptoCompraId);
            const relationDolarCriptoVentaPesoId = findRelationId(pesoId, dolarCriptoVentaId);
            const relationDolarTarjetaCompraPesoId = findRelationId(pesoId, dolarTarjetaCompraId);
            const relationDolarTarjetaVentaPesoId = findRelationId(pesoId, dolarTarjetaVentaId);

            console.log(`${updatedIndexes.length} indexes to update`);
            for (let i = 0; i < updatedIndexes.length; i++) {
                const date = updatedIndexes[i]?.date?.split('T')[0];
                //CPI
                if (updatedIndexes[i].cpi && !dbIndexes.find(x => x.currenciesRelationsId === relationMepCPIId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationMepCPIId, value: updatedIndexes[i].cpi });
                };
                // Informal Compra y Venta
                if (updatedIndexes[i].informal?.compra && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarLibreCompraPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarLibreCompraPesoId, value: updatedIndexes[i].informal.compra });
                };
                if (updatedIndexes[i].informal?.venta && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarLibreVentaPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarLibreVentaPesoId, value: updatedIndexes[i].informal.venta });
                };

                // Dolar Oficial
                if (updatedIndexes[i].oficial?.compra && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarOficialCompraPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarOficialCompraPesoId, value: updatedIndexes[i].oficial.compra });
                };
                if (updatedIndexes[i].oficial?.venta && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarOficialVentaPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarOficialVentaPesoId, value: updatedIndexes[i].oficial.venta });
                };

                //Dolar CCL
                if (updatedIndexes[i].ccl?.compra && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarCclCompraPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarCclCompraPesoId, value: updatedIndexes[i].ccl.compra });
                };
                if (updatedIndexes[i].ccl?.venta && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarCclVentaPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarCclVentaPesoId, value: updatedIndexes[i].ccl.venta });
                };

                //Dolar Mayorista
                if (updatedIndexes[i].mayorista?.compra && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarMayoristaCompraPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarMayoristaCompraPesoId, value: updatedIndexes[i].mayorista.compra });
                };
                if (updatedIndexes[i].mayorista?.venta && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarMayoristaVentaPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarMayoristaVentaPesoId, value: updatedIndexes[i].mayorista.venta });
                };

                //Dolar Cripto
                if (updatedIndexes[i].cripto?.compra && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarCriptoCompraPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarCriptoCompraPesoId, value: updatedIndexes[i].cripto.compra });
                };
                if (updatedIndexes[i].cripto?.venta && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarCriptoVentaPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarCriptoVentaPesoId, value: updatedIndexes[i].cripto.venta });
                };

                //Dolar Mep
                if (updatedIndexes[i].mep?.compra && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarMepCompraPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarMepCompraPesoId, value: updatedIndexes[i].mep.compra });
                };
                if (updatedIndexes[i].mep?.venta && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarMepVentaPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarMepVentaPesoId, value: updatedIndexes[i].mep.venta });
                };

                // Dolar Tarjeta
                if (updatedIndexes[i].tarjeta?.compra && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarTarjetaCompraPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarTarjetaCompraPesoId, value: updatedIndexes[i].tarjeta.compra });
                };
                if (updatedIndexes[i].tarjeta?.venta && !dbIndexes.find(x => x.currenciesRelationsId === relationDolarTarjetaVentaPesoId && x.date === date)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationDolarTarjetaVentaPesoId, value: updatedIndexes[i].tarjeta.venta });
                };

                // CAC
                if (updatedIndexes[i].cac && !dbIndexes.find(x => x.currenciesRelationsId === relationCACPesoId)) {
                    await this.db.db.insert(currencyIndexes).values({ date, currenciesRelationsId: relationCACPesoId, value: updatedIndexes[i].cac.general });
                }

                // UVA
                if (updatedIndexes[i].uva && !dbIndexes.find(x => x.date === date && x.currenciesRelationsId === relationUVAPesoId)) {
                    await this.db.db.insert(currencyIndexes).values({ date, value: updatedIndexes[i].uva, currenciesRelationsId: relationUVAPesoId });
                };

            }
            console.log('Ultima fecha', updatedIndexes[updatedIndexes.length - 1]);
            return {
                updatedIndexes: updatedIndexes.length,
                dbIndexes: dbIndexes.length,
                relationCACPesoId,
                relationDolarCclCompraPesoId,
                relationDolarCclVentaPesoId,
                relationDolarMayoristaCompraPesoId,
                relationDolarMayoristaVentaPesoId,
                relationDolarCriptoCompraPesoId,
                relationDolarCriptoVentaPesoId,
                relationDolarMepCompraPesoId,
                relationDolarMepVentaPesoId,
                relationDolarTarjetaCompraPesoId,
                relationDolarTarjetaVentaPesoId
            };
        };
        const currencyIndexesData = (await this.db.db.select().from(currencyIndexes))
        const currenciesData = (await this.db.db.select().from(currencies)).map((x: any) => ({
            id: x.id,
            code: x.code,
            label: x.label,
            symbol: x.symbol,
        })) as Currency[];
       // console.log('currenciesData', currenciesData?.length);
        const currenciesRelationsData = (await this.db.db.select().from(currenciesRelations))
        const updatedIndexes = await getUpdatedIndexes();
        let res = await syncToDatabase(currenciesData, currenciesRelationsData, currencyIndexesData, updatedIndexes);
        return res
    };


}