import { Injectable } from "@nestjs/common";
import { db } from "../drizzle/index";
import { indexes, currencies, relationsCurrencies, Currency, Index, RelationsCurrencies } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import axios from "axios";
import puppeteer from "puppeteer";
import * as fs from 'fs';
import { IndexesCacheService } from './indexes-cache.service';
const scrapeInflation = async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto("https://www.usinflationcalculator.com/inflation/consumer-price-index-and-annual-percent-changes-from-1913-to-2008/", {
        waitUntil: "domcontentloaded"
    });
    // const html = await page.content(); // obtiene el HTML actual
    // console.log('html', html);

    const inflationData: { date: string, value: number }[] = await page.evaluate(() => {
        const data: { date: string, value: number }[] = [];
        const table = document.querySelector("table"); // adaptá si es un selector más específico
        if (!table) return data;

        const rows = Array.from(table.querySelectorAll("tr"));
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll("td"));
            if (cells.length < 13) continue; // ignorar filas incompletas

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
    fs.writeFileSync("inflationData.json", JSON.stringify(inflationData)); // lo guarda en un archivo
    await browser.close();
    return inflationData;
};
const generateDateArrayUntilToday = (startDateStr: String, endDateStr = null) => {
    // Crear la fecha de inicio en UTC
    const startDate = new Date(Date.UTC(
        parseInt(startDateStr.split('-')[0]),  // Año
        parseInt(startDateStr.split('-')[1]) - 1,  // Mes (0-indexed)
        parseInt(startDateStr.split('-')[2])   // Día
    ));

    // Crear la fecha de hoy en UTC
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
interface CacData {
    period: string; // YYYY-MM format
}

interface UvaUviData {
    fecha: string; // DD-MM-YYYY format
    valor: number;
}

interface DolaritoData {
    [key: string]: number | undefined; // Mapea fechas a valores
}
interface DolarAbsolutoData {
    fecha: string; // DD-MM-YYYY format
    valor: number;
}
@Injectable()
export class IndexesService {
    constructor(
        private readonly indexesCacheService: IndexesCacheService
    ) { }
    async getCachedPaths() {
        const paths = this.indexesCacheService.getCachedPaths();
        return paths;
    }
    async getAllIndexes() {
        return db.select().from(indexes);
    }
    async getIndexesByDate(date: string) {
        return db.select().from(indexes).where(eq(indexes.date, date));
    }
    async updateMissingIndexes() {
        const getUpdatedIndexes = async () => {
            const inflationData = (await scrapeInflation());
            const cacResponse = await axios.get('https://prestamos.ikiwi.net.ar/api/cacs');
            const uvaResponse = await axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uva/valores/");
            const uviResponse = await axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uvi/valores/");
            const dolaritoResponse = await fetch("https://api.dolarito.ar/api/frontend/history", {
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "auth-client": "32f8a7c848e4119d1aa2310989e35ccf",//env.dolarito.auth,//process.env.DOLARITO_AUTH, // <- token de ejemplo
                    "origin": "https://www.dolarito.ar",
                    "referer": "https://www.dolarito.ar/"
                },
                method: "GET"
            });
            // Verificar si la respuesta es exitosa
            if (!dolaritoResponse.ok) {
                throw new Error(`HTTP Error ${dolaritoResponse.status}: ${dolaritoResponse.statusText}`);
            };
            const datosCAC = cacResponse.data;
            const datosUVA = uvaResponse.data;
            const datosUVI = uviResponse.data;
            const datosDolarito = await dolaritoResponse.json();
            let dolar = 1
            const datosDolarAbsoluto = inflationData?.reduce((acc: DolarAbsolutoData[], curr: { date: string, value: number }, i, arr) => {
                const prev = arr[i - 1]?.value ?? 0;
                if (prev === 0) return [{ fecha: curr.date, valor: dolar }]; // Evitar división por cero
                const tasaCrecimiento = (curr.value - prev) / prev;
                dolar = dolar * (1 + tasaCrecimiento);
                acc.push({ fecha: curr.date, valor: dolar })
                return acc;
            }, []);
            fs.writeFileSync("datosDolarAbsoluto.json", JSON.stringify(datosDolarAbsoluto)); // lo guarda en un archivo
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

                const dolaritoIndex = datosDolarito[`${day}-${month}-${year.substring(2, 4)}`];
                const dolarAbsolutoIndex = datosDolarAbsoluto.find((x: DolarAbsolutoData) => {
                    const [_month, _year] = x.fecha.split('-');
                    return _month === month && _year === year;
                });
                return {
                    date: d,
                    ...dolaritoIndex,
                    cac: cacIndex,
                    uva: uvaIndex?.valor,
                    uvi: uviIndex?.valor,
                    dolarAbsoluto: dolarAbsolutoIndex?.valor,
                }
            });
        };
        const updateIndexes = async (
            currencies: { id: number; name: string; symbol?: string; }[],
            relationsCurrencies: { id: number; dividendoId: number; divisorId: number }[],
            dbIndexes: Array<{ relationsCurrencies: number; date: string }>,
            updatedIndexes: Array<{ date: string;[key: string]: any }>
        ) => {
            const findCurrencyId = (name: string) => currencies.find(x => x.name === name)?.id ?? null;
            const findRelationId = (dividendoId: number, divisorId: number) => relationsCurrencies.find(x => x.dividendoId === dividendoId && divisorId === x.divisorId)?.id ?? null;
            const pesoId = findCurrencyId('Peso');
            const dolar2000Id = findCurrencyId('Dolar 2000');
            const cacId = findCurrencyId('CAC');
            const uvaId = findCurrencyId('UVA');
            const dolarCompraId = findCurrencyId('Dolar Compra');
            const mepCompraId = findCurrencyId('Dolar MEP Compra');
            const oficialCompraId = findCurrencyId('Dolar Oficial Compra');
            const dolarVentaId = findCurrencyId('Dolar Venta');
            const mepVentaId = findCurrencyId('Dolar MEP Venta');
            const oficialVentaId = findCurrencyId('Dolar Oficial Venta');
            const dolarId = findCurrencyId('Dolar Libre');
            const mepId = findCurrencyId('Dolar MEP');
            const oficialId = findCurrencyId('Dolar Oficial');
            const relationPesoDolarLibreId = findRelationId(pesoId, dolarId);
            const relationDolarLibrePesoId = findRelationId(dolarId, pesoId);
            const relationCACPesoId = findRelationId(cacId, pesoId);
            const relationUVAPesoId = findRelationId(uvaId, pesoId);
            const relationDolarLibreCompraPesoId = findRelationId(dolarCompraId, pesoId);
            const relationDolarLibreVentaPesoId = findRelationId(dolarVentaId, pesoId);
            const relationDolarMepCompraPesoId = findRelationId(mepCompraId, pesoId);
            const relationDolarMepVentaPesoId = findRelationId(mepVentaId, pesoId);
            const relationDolarOficialCompraPesoId = findRelationId(oficialCompraId, pesoId);
            const relationDolarOficialVentaPesoId = findRelationId(oficialVentaId, pesoId);
            const relationDolarMepPesoId = findRelationId(mepId, pesoId);
            const relationDolarOficialPesoId = findRelationId(oficialId, pesoId);
            const relationDolar2000 = findRelationId(dolar2000Id, dolar2000Id);

            //Valor del peso = 1/valorDolarBlueEnDolar2000 ?
            for (let i = 0; i < updatedIndexes.length; i++) {
                const date = updatedIndexes[i]?.date?.split('T')[0];

                // PROMEDIOS
                if (updatedIndexes[i].informal && !dbIndexes.find(x => x.relationsCurrencies === relationDolarLibrePesoId && x.date === date)) {
                    const valueInformal = (updatedIndexes[i].informal.compra + updatedIndexes[i].informal.venta) / 2;
                    // Buscar el valor del peso
                    if (!dbIndexes.find(x => x.relationsCurrencies === relationPesoDolarLibreId && x.date === date)) {
                        await db.insert(indexes).values({ date, value: 1 / valueInformal, relationsCurrencies: relationPesoDolarLibreId, });
                    }
                    await db.insert(indexes).values({ date, relationsCurrencies: relationDolarLibrePesoId, value: valueInformal });
                }

                if (updatedIndexes[i].mep && !dbIndexes.find(x => x.relationsCurrencies === relationDolarMepPesoId && x.date === date)) {
                    const valueMep = (updatedIndexes[i].mep.compra + updatedIndexes[i].mep.venta) / 2;
                    await db.insert(indexes).values({ date, relationsCurrencies: relationDolarMepPesoId, value: valueMep });
                }

                if (updatedIndexes[i].oficial && !dbIndexes.find(x => x.relationsCurrencies === relationDolarOficialPesoId && x.date === date)) {
                    const valueOficial = (updatedIndexes[i].oficial.compra + updatedIndexes[i].oficial.venta) / 2;
                    await db.insert(indexes).values({ date, relationsCurrencies: relationDolarOficialPesoId, value: valueOficial });
                }

                // Compra-Venta
                if (updatedIndexes[i].informal?.compra && !dbIndexes.find(x => x.relationsCurrencies === relationDolarLibreCompraPesoId && x.date === date)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].informal.compra, relationsCurrencies: relationDolarLibreCompraPesoId });
                }

                if (updatedIndexes[i].informal?.venta && !dbIndexes.find(x => x.date === date && x.relationsCurrencies === relationDolarLibreVentaPesoId)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].informal.venta, relationsCurrencies: relationDolarLibreVentaPesoId });
                }

                if (updatedIndexes[i].mep?.compra && !dbIndexes.find(x => x.date === date && x.relationsCurrencies === relationDolarMepCompraPesoId)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].mep.compra, relationsCurrencies: relationDolarMepCompraPesoId });
                }

                if (updatedIndexes[i].mep?.venta && !dbIndexes.find(x => x.date === date && x.relationsCurrencies === relationDolarMepVentaPesoId)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].mep.venta, relationsCurrencies: relationDolarMepVentaPesoId });
                }

                if (updatedIndexes[i].oficial?.compra && !dbIndexes.find(x => x.date === date && x.relationsCurrencies === relationDolarOficialCompraPesoId)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].oficial.compra, relationsCurrencies: relationDolarOficialCompraPesoId });
                }

                if (updatedIndexes[i].oficial?.venta && !dbIndexes.find(x => x.date === date && x.relationsCurrencies === relationDolarOficialVentaPesoId)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].oficial.venta, relationsCurrencies: relationDolarOficialVentaPesoId });
                }

                // Unitarios
                if (updatedIndexes[i].cac && !dbIndexes.find(x => x.date === date && x.relationsCurrencies === relationCACPesoId)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].cac.general, relationsCurrencies: relationCACPesoId });
                }

                if (updatedIndexes[i].uva && !dbIndexes.find(x => x.date === date && x.relationsCurrencies === relationUVAPesoId)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].uva, relationsCurrencies: relationUVAPesoId });
                }

                if (updatedIndexes[i].dolarAbsoluto && !dbIndexes.find(x => x.date === date && x.relationsCurrencies === relationDolar2000)) {
                    await db.insert(indexes).values({ date, value: updatedIndexes[i].dolarAbsoluto, relationsCurrencies: relationDolar2000 });
                }
            }

            return {
                updatedIndexes: updatedIndexes.length,
                dbIndexes: dbIndexes.length,
                dolarVentaId,
                cacId,
                mepVentaId,
                oficialVentaId,
                dolarCompraId,
                uvaId,
                mepCompraId,
                oficialCompraId,
                dolarId,
                mepId,
                oficialId
            };
        };
        const indexesData = (await db.select().from(indexes))
        const currenciesData = (await db.select().from(currencies)).map((x: any) => ({
            id: x.id,
            name: x.name,
            symbol: x.symbol,
        })) as Currency[];
        const relationsCurrenciesData = (await db.select().from(relationsCurrencies))
        const updatedIndexes = await getUpdatedIndexes();
        let res = await updateIndexes(currenciesData, relationsCurrenciesData, indexesData, updatedIndexes);
        return res
    }

    async updateAllIndexes() {
        return
    }
    async getConversion({ from, to, amount, constantUnit = 1 }: { from: { currency: string, date: string }, to: { currency?: string, date: string }, amount: number, constantUnit?: number }) {
        const posiblePaths = this.indexesCacheService.getCachedPaths();
        const findPath = (fromId: number, toId: number) => {
            const path = posiblePaths[fromId].find(arr => arr.some(x => x.dividendoId === toId || x.divisorId === toId));
            const subPath = path.reduce((p, x) => {
                if (!p.some(x => x.dividendoId === toId || x.divisorId === toId)) {
                    p.push(x)
                };
                return p;
            }, []);
            return subPath;
        };
        const toUnit = (fromId: number, toId: number, indexes: Index[], path: RelationsCurrencies[], amount: number) => {
            const removeRedundants = (path: RelationsCurrencies[]) => {
                // const isRedundant = (path: RelationsCurrencies[]) => path.some((x, i) => {
                //     //Esto está bien?
                //     //Path desde el 2 al 8:
                //     [
                //         { id: 2, divisorId: 2, dividendoId: 3 },
                //         { id: 3, divisorId: 3, dividendoId: 2 },
                //         { id: 4, divisorId: 3, dividendoId: 4 },
                //         { id: 5, divisorId: 3, dividendoId: 5 },
                //         { id: 6, divisorId: 3, dividendoId: 6 },
                //         { id: 7, divisorId: 3, dividendoId: 7 },
                //         { id: 8, divisorId: 3, dividendoId: 8 }
                //       ]
                //     path.some((y, j) => j > i + 1 && [x.divisorId, x.dividendoId].includes(y.dividendoId) ||
                //         [x.divisorId, x.dividendoId].includes(y.divisorId))
                // });
                const isRedundant = (path: RelationsCurrencies[]) => path.some((x, i) => {
                    //Esto está bien?
                    //Path desde el 2 al 8:
                    [
                        { id: 2, divisorId: 2, dividendoId: 3 },
                        { id: 3, divisorId: 3, dividendoId: 2 },
                        { id: 4, divisorId: 3, dividendoId: 4 },
                        { id: 5, divisorId: 3, dividendoId: 5 },
                        { id: 6, divisorId: 3, dividendoId: 6 },
                        { id: 7, divisorId: 3, dividendoId: 7 },
                        { id: 8, divisorId: 3, dividendoId: 8 }
                      ]
                    path.some((y, j) => j > i + 1 && [x.divisorId, x.dividendoId].includes(y.dividendoId) ||
                        [x.divisorId, x.dividendoId].includes(y.divisorId))
                });
                const doCleanUp = (path: RelationsCurrencies[]) => {
                    const seenIds = new Set<number | string>();
                    const result: RelationsCurrencies[] = [];

                    for (let i = path.length - 1; i >= 0; i--) {
                        const { divisorId, dividendoId } = path[i];
                        if (
                            seenIds.has(divisorId) ||
                            seenIds.has(dividendoId)
                        ) continue;

                        result.unshift(path[i]);
                        seenIds.add(divisorId);
                        seenIds.add(dividendoId);
                    }

                    return result;
                };

                while (isRedundant(path)) {
                    path = doCleanUp(path);
                }

                return path;
            };
            let cleanPath = path//removeRedundants(path);
            let res = amount;
            let lastId = fromId;
            console.log(1.5, { fromId, toId, indexes, cleanPath, amount });
            for (let i = 0; i < cleanPath.length; i++) {
                let currentNode = cleanPath[i];
                let coef = indexes.find(x => x.relationsCurrencies === currentNode.id).value;
                console.log({ res, lastId, currentNode, coef });
                if (currentNode.dividendoId === lastId) {
                    res = res * coef;
                    //lastId = [cleanPath[i++].dividendoId,cleanPath[i++].divisorId].includes(currentNode.divisorId) ? currentNode.divisorId : currentNode.dividendoId;
                    lastId = currentNode.divisorId;
                } else {
                    res = res / coef;
                    //  lastId = [cleanPath[i++].dividendoId,cleanPath[i++].divisorId].includes(currentNode.dividendoId) ? currentNode.dividendoId : currentNode.divisorId;
                    lastId = currentNode.dividendoId;
                }
            };
            return res;
        };
        const getRevalorizedAmount = (constantUnit: number, fromId: number, fromIndexes: Index[], toIndexes: Index[], value: number, relationsData: RelationsCurrencies[]) => {
            const fromIndexConstantUnitData = fromIndexes.find(x => relationsData?.find(r => r.dividendoId === constantUnit)?.id === x.relationsCurrencies);
            const toIndexConstantUnitData = toIndexes.find(x => fromIndexConstantUnitData?.relationsCurrencies === x.relationsCurrencies);
            console.log({ fromIndexConstantUnitData, toIndexConstantUnitData });
            return value / fromIndexConstantUnitData.value * toIndexConstantUnitData.value
        }
        const relationsData = (await db.select().from(relationsCurrencies))
        const indexesData = (await db.select().from(indexes))
        const currenciesData = (await db.select().from(currencies))
        const fromIndexes = indexesData.filter(x => x.date === from.date);
        const toIndexes = indexesData.filter(x => x.date === to.date);


        const fromCurrencyId = currenciesData.find(x => x.name === from.currency)?.id ?? null;
        const toCurrencyId = currenciesData.find(x => x.name === to.currency)?.id ?? null;
        //const fromConstantPath = findPath(fromCurrencyId, constantUnit);
        console.log(1, { currenciesData, fromIndexes, toIndexes, fromCurrencyId, toCurrencyId });
        const toConstantPath = findPath(fromCurrencyId, toCurrencyId);
        const revalorizedFromValue = getRevalorizedAmount(constantUnit, fromCurrencyId, fromIndexes, toIndexes, amount, relationsData);
        const res = toUnit(fromCurrencyId, toCurrencyId, toIndexes, toConstantPath, amount);
        const revalorizedRes = toUnit(fromCurrencyId, toCurrencyId, toIndexes, toConstantPath, revalorizedFromValue);
        console.log(2, { res, revalorizedRes, revalorizedFromValue })
        //BAUTI
        // const fromCurrencyId = currenciesData.find(x => x.name === from.currency)?.id ?? null;
        // const toCurrencyId = currenciesData.find(x => x.name === to.currency)?.id ?? null;
        // const fromConstantPath = findPath(fromCurrencyId, constantUnit);
        // console.log({currenciesData, fromIndexes, toIndexes, fromCurrencyId, toCurrencyId, fromConstantPath});
        // const constantUnitAmount = toUnit(fromCurrencyId, constantUnit, fromIndexes, fromConstantPath, amount);
        // const toConstantPath = findPath(constantUnit, toCurrencyId);
        // const res = toUnit(constantUnit, toCurrencyId, toIndexes, toConstantPath, constantUnitAmount);

        return res;
        //try {
        //     let fromDate = from.date
        //     // Acá debería ir la fecha de la moneda a convertir, conseguir la inflacionUS y devolver un porcentaje del poder adquisitivo en dolares?
        //     //No importa la inflación de Arg solo la de US?
        //     //osea valorDolarBlueDateTo 
        //     let date = to.date

        //     const indexesData = (await db.select().from(indexes)).map(x => ({ ...x, date: x.date }));
        //     const currenciesData = await db.select().from(currencies);

        //     // Buscar las monedas en la base de datos
        //     const currencyFrom = currenciesData.find(c => c.name === from.currency);
        //     const currencyTo = currenciesData.find(c => c.name === to.currency);

        //     if (!currencyFrom || !currencyTo) {
        //         throw new Error("Invalid currency provided");
        //     }

        //     // Obtener el índice de conversión
        //     const indexToCurrencyFrom = currencyFrom.name === 'Peso' ? 1 : indexesData.find(i => i.date === date && i.dividendoId === currencyFrom.id)?.value;
        //     const indexTo = currencyTo.name === 'Peso' ? 1 : indexesData.find(i => i.date === date && i.dividendoId === currencyTo.id)?.value;

        //     if (!indexToCurrencyFrom || !indexTo) {
        //         throw new Error(`Conversion rate not found for the provided ${date}/${currencyTo.name}`);
        //     }

        //     // Calcular la conversión
        //     const result = (indexToCurrencyFrom * amount) / indexTo;

        //     return { result, date, currency: to.currency };
        // } catch (error) {
        //     console.error("Error en la conversión:", error);

        //     throw new Error("Error en la conversión de índices");
        // }
        // const fromCurrencys = await getDateCurrencys(from);
        // const fromAbsolute = fromCurrencys.reduce((acc, curr) => {

        // }, 0);
        // const toCurrencys = await getDateCurrencys(to);

    }
}
