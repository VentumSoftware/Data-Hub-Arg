import cron from 'node-cron';
import env from '../config/env.js';
import { mailer } from '../lib/index.js';
import { build } from './builder.js';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import {
  schema as tablesSchema, getCache, runQuery, getRows, getRow, getPaginatedRows,
  postRow, editRow, delRow
} from '../lib/tables/index.js';

const generateDateArrayUntilToday = (startDateStr, endDateStr = null) => {
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

//TODO: Move to lib

const updateIndexes = async () => {

  const getCurrencies = async () => {
    const currencies = await getRows('currencies');
    return currencies;
  };
  const getUpdatedIndexes = async () => {
    const cacResponse = await axios.get('https://prestamos.ikiwi.net.ar/api/cacs');
    const uvaResponse = await axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uva/valores/");
    const uviResponse = await axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uvi/valores/");
    const dolaritoResponse = await fetch("https://www.dolarito.ar/api/frontend/history", {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "auth-client": "446432d32e85275b149bfa3ec40254ba",
        "sec-ch-ua": "\"Google Chrome\";v=\"123\", \"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"123\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "Referer": "https://www.dolarito.ar/cotizaciones-historicas/informal",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": null,
      "method": "GET"
    })
    // Verificar si la respuesta es exitosa
    if (!dolaritoResponse.ok) {
      throw new Error(`HTTP Error ${dolaritoResponse.status}: ${dolaritoResponse.statusText}`);
    };
    const datosCAC = cacResponse.data;
    const datosUVA = uvaResponse.data;
    const datosUVI = uviResponse.data;
    const datosDolarito = await dolaritoResponse.json();
    const days = generateDateArrayUntilToday('2010-01-01');
    return days.map((d, i) => {

      const [year, month, day] = d.split('-');

      const cacIndex = datosCAC.find(x => {
        const [_year, _month, _day] = x.period.split('-');
        return _month === month && _year === year;
      });

      const uvaIndex = datosUVA.find(x => {
        const [_day, _month, _year] = x.fecha.split('-');
        return _day === day && _month === month && _year === year;
      });

      const uviIndex = datosUVI.find(x => {
        const [_day, _month, _year] = x.fecha.split('-');
        return _day === day && _month === month && _year === year;
      });

      const dolaritoIndex = datosDolarito[`${day}-${month}-${year.substring(2, 4)}`];

      return {
        date: d,
        ...dolaritoIndex,
        cac: cacIndex,
        uva: uvaIndex?.valor,
        uvi: uviIndex?.valor
      }
    });
  };
  const updateIndexes = async (currencies, dbIndexes, updatedIndexes) => {
    const cacId = currencies.find(x => x.name === 'CAC').id;
    const uvaId = currencies.find(x => x.name === 'UVA').id;
    const dolarCompraId = currencies.find(x => x.name === 'Dolar Compra').id;
    const mepCompraId = currencies.find(x => x.name === 'Dolar MEP Compra').id;
    const oficialCompraId = currencies.find(x => x.name === 'Dolar Oficial Compra').id;
    const dolarVentaId = currencies.find(x => x.name === 'Dolar Venta').id;
    const mepVentaId = currencies.find(x => x.name === 'Dolar MEP Venta').id;
    const oficialVentaId = currencies.find(x => x.name === 'Dolar Oficial Venta').id;



    for (let i = 0; i < updatedIndexes.length; i++) {
      const date = updatedIndexes[i]?.date?.split('T')[0];

      if (updatedIndexes[i].informal?.compra && dbIndexes.find(x => x.currency === dolarCompraId && x.date === date) == null) {
        const valueInformalCompra = updatedIndexes[i].informal.compra//(updatedIndexes[i].informal.compra + updatedIndexes[i].informal.venta) / 2;
 
        await postRow(`indexes`, { date, currency: dolarCompraId, value: valueInformalCompra });
      };

      if (updatedIndexes[i].informal?.venta && dbIndexes.find(x => x.currency === dolarVentaId && x.date === date) == null) {
        const valueInformalVenta = updatedIndexes[i].informal.venta//(updatedIndexes[i].informal.compra + updatedIndexes[i].informal.venta) / 2;

        await postRow(`indexes`, { date, currency: dolarVentaId, value: valueInformalVenta });
      };


      if (updatedIndexes[i].mep?.compra && dbIndexes.find(x => x.currency === mepCompraId && x.date === date) == null) {
        const valueMepCompra = updatedIndexes[i].mep.compra
 
        await postRow(`indexes`, { date, currency: mepCompraId, value: valueMepCompra });
      };
      if (updatedIndexes[i].mep?.venta && dbIndexes.find(x => x.currency === mepVentaId && x.date === date) == null) {
        const valueMepVenta = updatedIndexes[i].mep.venta
    
        await postRow(`indexes`, { date, currency: mepVentaId, value: valueMepVenta });
      };


      if (updatedIndexes[i].oficial?.compra && dbIndexes.find(x => x.currency === oficialCompraId && x.date === date) == null) {
        const valueOficialCompra = updatedIndexes[i].oficial.compra
 
        await postRow(`indexes`, { date, currency: oficialCompraId, value: valueOficialCompra });
      }
      if (updatedIndexes[i].oficial?.venta && dbIndexes.find(x => x.currency === oficialVentaId && x.date === date) == null) {
        const valueOficialVenta = (updatedIndexes[i].oficial.venta)
     
        await postRow(`indexes`, { date, currency: oficialVentaId, value: valueOficialVenta });
      }


      if (updatedIndexes[i].cac && dbIndexes.find(x => x.currency === cacId && x.date === date) == null) {
        const valueCAC = updatedIndexes[i].cac.general;

        await postRow(`indexes`, { date, currency: cacId, value: valueCAC });
      };
      if (updatedIndexes[i].uva && dbIndexes.find(x => x.currency === uvaId && x.date === date) == null) {
        const valueUVA = updatedIndexes[i].uva.general || 0;
        console.log({uva:updatedIndexes[i].uva})
        await postRow(`indexes`, { date, currency: uvaId, value: valueUVA });
      };
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
      oficialCompraId
    }
  };
  console.log('Actualizando índices faltantes')
  const currencies = await getCurrencies();
  const dbIndexes = (await getRows('indexes')).map(x => ({ ...x, date: (x.date.toISOString().slice(0, 10)).toString() }));
  const updatedIndexes = await getUpdatedIndexes();
  let res = await updateIndexes(currencies, dbIndexes, updatedIndexes);
  return res
}
// Programar la ejecución cada 10 minutos
cron.schedule('*/10 * * * *', async () => {
  console.log('cron update')
  await updateIndexes();
});
const init = async () => {
  console.log('init')
  await updateIndexes()
}
await init()

export default build([
  {
    route: '/api/tables/rows/:tableName',
    description: ' ',
    method: 'get',
    validations: {
      auth: null,
    },
    action: async (req, res) => {
      const { params, query } = req;
      res.body = await getRows(params.tableName);
      return res.body;
    }
  },
  //CUSTOMS:
  {
    route: '/api/update-all-indexes',
    description: 'Scraps and Updates Indexes.',
    method: 'get',
    validations: {
      auth: null,
      query: null,
      body: null,
      params: null
    },
    action: async (req, res) => {
      try {
        const getCurrencies = async () => {
          const currencies = await getRows('currencies');
          return 'currencies';
        };
        const getUpdatedIndexes = async () => {
          const cacResponse = await axios.get('https://prestamos.ikiwi.net.ar/api/cacs');
          const uvaResponse = await axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uva/valores/");
          const uviResponse = await axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uvi/valores/");
          const dolaritoResponse = await fetch("https://www.dolarito.ar/api/frontend/history", {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "auth-client": "0022200edebd6eaee37427532323d88b",
              "sec-ch-ua": "\"Google Chrome\";v=\"123\", \"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"123\"",
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": "\"Windows\"",
              "Referer": "https://www.dolarito.ar/cotizaciones-historicas/informal",
              "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            "body": null,
            "method": "GET"
          })

          const datosCAC = cacResponse.data;
          const datosUVA = uvaResponse.data;
          const datosUVI = uviResponse.data;
          const datosDolarito = await dolaritoResponse.json();
          const days = generateDateArrayUntilToday('2010-01-01', '2025-01-01');
          return days.map((d, i) => {

            const [year, month, day] = d.split('-');

            const cacIndex = datosCAC.find(x => {
              const [_year, _month, _day] = x.period.split('-');
              return _month === month && _year === year;
            });

            const uvaIndex = datosUVA.find(x => {
              const [_day, _month, _year] = x.fecha.split('-');
              return _day === day && _month === month && _year === year;
            });

            const uviIndex = datosUVI.find(x => {
              const [_day, _month, _year] = x.fecha.split('-');
              return _day === day && _month === month && _year === year;
            });

            const dolaritoIndex = datosDolarito[`${day}-${month}-${year.substring(2, 4)}`];

            return {
              date: d,
              ...dolaritoIndex,
              cac: cacIndex,
              uva: uvaIndex?.valor,
              uvi: uviIndex?.valor
            }
          });
        };
        const updateIndexes = async (currencies, dbIndexes, updatedIndexes) => {
          const cacId = currencies.find(x => x.name === 'CAC').id;
          const uvaId = currencies.find(x => x.name === 'UVA').id;
          const dolarCompraId = currencies.find(x => x.name === 'Dolar Compra').id;
          const mepCompraId = currencies.find(x => x.name === 'Dolar MEP Compra').id;
          const oficialCompraId = currencies.find(x => x.name === 'Dolar Oficial Compra').id;
          const dolarVentaId = currencies.find(x => x.name === 'Dolar Venta').id;
          const mepVentaId = currencies.find(x => x.name === 'Dolar MEP Venta').id;
          const oficialVentaId = currencies.find(x => x.name === 'Dolar Oficial Venta').id;



          for (let i = 0; i < updatedIndexes.length; i++) {
            const date = updatedIndexes[i]?.date?.split('T')[0];

            if (updatedIndexes[i].informal?.compra && dbIndexes.find(x => x.currency === dolarCompraId && x.date === date) == null) {
              const valueInformalCompra = updatedIndexes[i].informal.compra//(updatedIndexes[i].informal.compra + updatedIndexes[i].informal.venta) / 2;
       
              await postRow(`indexes`, { date, currency: dolarCompraId, value: valueInformalCompra });
            };

            if (updatedIndexes[i].informal?.venta && dbIndexes.find(x => x.currency === dolarVentaId && x.date === date) == null) {
              const valueInformalVenta = updatedIndexes[i].informal.venta//(updatedIndexes[i].informal.compra + updatedIndexes[i].informal.venta) / 2;
 
              await postRow(`indexes`, { date, currency: dolarVentaId, value: valueInformalVenta });
            };


            if (updatedIndexes[i].mep.compra && dbIndexes.find(x => x.currency === mepCompraId && x.date === date) == null) {
              const valueMepCompra = updatedIndexes[i].mep.compra
       
              await postRow(`indexes`, { date, currency: mepCompraId, value: valueMepCompra });
            };
            if (updatedIndexes[i].mep.venta && dbIndexes.find(x => x.currency === mepVentaId && x.date === date) == null) {
              const valueMepVenta = updatedIndexes[i].mep.venta
          
              await postRow(`indexes`, { date, currency: mepVentaId, value: valueMepVenta });
            };


            if (updatedIndexes[i].oficial.compra && dbIndexes.find(x => x.currency === oficialCompraId && x.date === date) == null) {
              const valueOficialCompra = updatedIndexes[i].oficial.compra
       
              await postRow(`indexes`, { date, currency: oficialCompraId, value: valueOficialCompra });
            }
            if (updatedIndexes[i].oficial.venta && dbIndexes.find(x => x.currency === oficialVentaId && x.date === date) == null) {
              const valueOficialVenta = (updatedIndexes[i].oficial.venta)
           
              await postRow(`indexes`, { date, currency: oficialVentaId, value: valueOficialVenta });
            }


            if (updatedIndexes[i].cac && dbIndexes.find(x => x.currency === cacId && x.date === date) == null) {
              const valueCAC = updatedIndexes[i].cac.general;
 
              await postRow(`indexes`, { date, currency: cacId, value: valueCAC });
            };
            if (updatedIndexes[i].uva && dbIndexes.find(x => x.currency === uvaId && x.date === date) == null) {
              const valueUVA = updatedIndexes[i].uva.general || 0;
            
              await postRow(`indexes`, { date, currency: uvaId, value: valueUVA });
            };
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
            oficialCompraId
          };
        };
        let currencies1 = await getRows('currencies');
        let indexes = await getRows('indexes');
        console.log({ currencies1, indexes })
        await runQuery(`DELETE FROM indexes;
        ALTER SEQUENCE indexes_id_seq RESTART WITH 1;`);
        console.log('Se han eliminado los índices de la tabla...')
        const currencies = await getCurrencies();
        const dbIndexes = []//(await getRows('indexes')).map(x => ({ ...x, date: x.date }));
        const updatedIndexes = await getUpdatedIndexes();
        //fs.writeFileSync('./indexes.json', JSON.stringify({ updatedIndexes, currencies, dbIndexes }, null, 2));
        res.body = await updateIndexes(currencies, dbIndexes, updatedIndexes);
      } catch (error) {
        console.error("Error en el endpoint:", error);

        // Enviar email con el error
        await mailer.sendMail({
          from: process.env.MAIL_CUPONES_FROM,
          to: process.env.MAIL_CUPONES_TO,
          subject: "Error en la actualización de todos los índices",
          text: `Se ha producido un error en el endpoint:\n\n${error.message}\n\nStack:\n${error.stack}`,
        });

        // Responder con error
        res.status(500).json({ error: "Error en la actualización de índices" });
      }
    }
  },
  {
    route: '/api/update-indexes',
    description: 'Scraps and Updates Indexes.',
    method: 'get',
    validations: {
      auth: null,
      query: null,
      body: null,
      params: null
    },
    action: async (req, res) => {
      try {
        const getCurrencies = async () => {
          const currencies = await getRows('currencies');
          return currencies ;
        };
        const getUpdatedIndexes = async () => {
          const cacResponse = await axios.get('https://prestamos.ikiwi.net.ar/api/cacs');
          const uvaResponse = await axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uva/valores/");
          const uviResponse = await axios.get("https://prestamos.ikiwi.net.ar/api/v1/engine/uvi/valores/");
          const dolaritoResponse = await fetch("https://www.dolarito.ar/api/frontend/history", {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "auth-client": "0022200edebd6eaee37427532323d88b",
              "sec-ch-ua": "\"Google Chrome\";v=\"123\", \"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"123\"",
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": "\"Windows\"",
              "Referer": "https://www.dolarito.ar/cotizaciones-historicas/informal",
              "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            "body": null,
            "method": "GET"
          })

          const datosCAC = cacResponse.data;
          const datosUVA = uvaResponse.data;
          const datosUVI = uviResponse.data;
          const datosDolarito = await dolaritoResponse.json();
          const days = generateDateArrayUntilToday('2010-01-01');
          return days.map((d, i) => {

            const [year, month, day] = d.split('-');

            const cacIndex = datosCAC.find(x => {
              const [_year, _month, _day] = x.period.split('-');
              return _month === month && _year === year;
            });

            const uvaIndex = datosUVA.find(x => {
              const [_day, _month, _year] = x.fecha.split('-');
              return _day === day && _month === month && _year === year;
            });

            const uviIndex = datosUVI.find(x => {
              const [_day, _month, _year] = x.fecha.split('-');
              return _day === day && _month === month && _year === year;
            });

            const dolaritoIndex = datosDolarito[`${day}-${month}-${year.substring(2, 4)}`];

            return {
              date: d,
              ...dolaritoIndex,
              cac: cacIndex,
              uva: uvaIndex?.valor,
              uvi: uviIndex?.valor
            }
          });
        };
        const updateIndexes = async (currencies, dbIndexes, updatedIndexes) => {
          const cacId = currencies.find(x => x.name === 'CAC').id;
          const uvaId = currencies.find(x => x.name === 'UVA').id;
          const dolarCompraId = currencies.find(x => x.name === 'Dolar Compra').id;
          const mepCompraId = currencies.find(x => x.name === 'Dolar MEP Compra').id;
          const oficialCompraId = currencies.find(x => x.name === 'Dolar Oficial Compra').id;
          const dolarVentaId = currencies.find(x => x.name === 'Dolar Venta').id;
          const mepVentaId = currencies.find(x => x.name === 'Dolar MEP Venta').id;
          const oficialVentaId = currencies.find(x => x.name === 'Dolar Oficial Venta').id;



          for (let i = 0; i < updatedIndexes.length; i++) {
            const date = updatedIndexes[i]?.date?.split('T')[0];

            if (updatedIndexes[i].informal?.compra && dbIndexes.find(x => x.currency === dolarCompraId && x.date === date) == null) {
              const valueInformalCompra = updatedIndexes[i].informal.compra//(updatedIndexes[i].informal.compra + updatedIndexes[i].informal.venta) / 2;
       
              await postRow(`indexes`, { date, currency: dolarCompraId, value: valueInformalCompra });
            };

            if (updatedIndexes[i].informal?.venta && dbIndexes.find(x => x.currency === dolarVentaId && x.date === date) == null) {
              const valueInformalVenta = updatedIndexes[i].informal.venta//(updatedIndexes[i].informal.compra + updatedIndexes[i].informal.venta) / 2;
 
              await postRow(`indexes`, { date, currency: dolarVentaId, value: valueInformalVenta });
            };


            if (updatedIndexes[i].mep.compra && dbIndexes.find(x => x.currency === mepCompraId && x.date === date) == null) {
              const valueMepCompra = updatedIndexes[i].mep.compra
       
              await postRow(`indexes`, { date, currency: mepCompraId, value: valueMepCompra });
            };
            if (updatedIndexes[i].mep.venta && dbIndexes.find(x => x.currency === mepVentaId && x.date === date) == null) {
              const valueMepVenta = updatedIndexes[i].mep.venta
          
              await postRow(`indexes`, { date, currency: mepVentaId, value: valueMepVenta });
            };


            if (updatedIndexes[i].oficial.compra && dbIndexes.find(x => x.currency === oficialCompraId && x.date === date) == null) {
              const valueOficialCompra = updatedIndexes[i].oficial.compra
       
              await postRow(`indexes`, { date, currency: oficialCompraId, value: valueOficialCompra });
            }
            if (updatedIndexes[i].oficial.venta && dbIndexes.find(x => x.currency === oficialVentaId && x.date === date) == null) {
              const valueOficialVenta = (updatedIndexes[i].oficial.venta)
           
              await postRow(`indexes`, { date, currency: oficialVentaId, value: valueOficialVenta });
            }


            if (updatedIndexes[i].cac && dbIndexes.find(x => x.currency === cacId && x.date === date) == null) {
              const valueCAC = updatedIndexes[i].cac.general;
 
              await postRow(`indexes`, { date, currency: cacId, value: valueCAC });
            };
            if (updatedIndexes[i].uva && dbIndexes.find(x => x.currency === uvaId && x.date === date) == null) {
              const valueUVA = updatedIndexes[i].uva.general || 0;
              await postRow(`indexes`, { date, currency: uvaId, value: valueUVA });
            };
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
            oficialCompraId
          };
        };
        console.log('Actualizando índices faltantes')
        const currencies = await getCurrencies();
        const dbIndexes = (await getRows('indexes')).map(x => ({ ...x, date: (x.date.toISOString().slice(0, 10)).toString() }));
        const updatedIndexes = await getUpdatedIndexes();
        //fs.writeFileSync('./indexes.json', JSON.stringify({ updatedIndexes, currencies, dbIndexes }, null, 2));
        res.body = await updateIndexes(currencies, dbIndexes, updatedIndexes);
      } catch (error) {
        console.error("Error en el endpoint:", error);

        // Enviar email con el error
        await mailer.sendMail({
          from: process.env.MAIL_CUPONES_FROM,
          to: process.env.MAIL_CUPONES_TO,
          subject: "Error en la actualización de índices",
          text: `Se ha producido un error en el endpoint:\n\n${error.message}\n\nStack:\n${error.stack}`,
        });

        // Responder con error
        res.status(500).json({ error: "Error en la actualización de índices" });
      }
    }
  },
  {
    route: '/api/get-indexes',
    description: 'Retrieves indexes ordered by day.',
    method: 'get',
    validations: {
      auth: null
    },
    action: async (req, res) => {

      try {
        const subtractTwoMonths = (dateStr) => {
          const [year, month, day] = dateStr.split('-').map(x => parseInt(x));
          const monthMinus2 = month > 2 ? month - 2 : month + 10;
          const yearMinus2 = month > 2 ? year : year - 1;
          return `${yearMinus2}-${String(monthMinus2).padStart(2, '0')}-01`;
        };

        const days = generateDateArrayUntilToday('2022-01-01');
        const indexes = (await getRows('indexes')).map(x => ({ ...x, date: (x.date.toISOString().slice(0, 10)).toString() }));

        const currencies = await getRows('currencies');
        res.body = Object.entries(days.reduce((p, date) => {
          p[date] = indexes.filter(indexObj => indexObj.date === date).map(indexObj => ({ ...indexObj, currency: currencies.find(c => c.id === indexObj.currency) }));

          return p;

        }, {}))
          .map(([date, indexesDate], i, arr) => {
            const monthMinus2 = subtractTwoMonths(date);
            const cacMinus2 = arr.find(date => date[0] === monthMinus2 && date[1].find(indexObj => indexObj.currency.name === 'CAC'))?.[1]?.find(x => x.currency.name === 'CAC')?.value;

            return {
              id: date,
              date: date,
              dolarVenta: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Venta')?.value,
              cac: indexesDate?.find(indexObj => indexObj.currency.name === 'CAC')?.value,
              mepVenta: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar MEP Venta')?.value,
              oficialVenta: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Oficial Venta')?.value,
              dolarCompra: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Compra')?.value,
              mepCompra: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar MEP Compra')?.value,
              oficialCompra: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Oficial Compra')?.value,
              uva: indexesDate?.find(indexObj => indexObj.currency.name === 'UVA')?.value,
              cacMinus2,
            }
          }).map((v, i, arr) => ({
            ...v,
            dolar: v.dolar || arr[i - 1]?.dolar || arr[i - 2]?.dolar || arr[i - 3]?.dolar || arr[i - 4]?.dolar,
            mep: v.mep || arr[i - 1]?.mep || arr[i - 2]?.mep || arr[i - 3]?.mep || arr[i - 4]?.mep,
            oficial: v.oficial || arr[i - 1]?.oficial || arr[i - 2]?.oficial || arr[i - 3]?.oficial || arr[i - 4]?.oficial,
          }));
      } catch (error) {
        console.error("Error en el endpoint:", error);

        // Enviar email con el error
        await mailer.sendMail({
          from: process.env.MAIL_CUPONES_FROM,
          to: process.env.MAIL_CUPONES_TO,
          subject: "Error en la obtención de todos los índices",
          text: `Se ha producido un error en el endpoint:\n\n${error.message}\n\nStack:\n${error.stack}`,
        });

        // Responder con error
        res.status(500).json({ error: "Error en la actualización de índices" });
      }
    }

  }
]);
