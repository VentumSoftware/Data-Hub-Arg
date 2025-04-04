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
        "auth-client": env.dolarito.auth,
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
    const dolarId = currencies.find(x => x.name === 'Dolar').id;
    const mepId = currencies.find(x => x.name === 'Dolar MEP').id;
    const oficialId = currencies.find(x => x.name === 'Dolar Oficial').id;

    for (let i = 0; i < updatedIndexes.length; i++) {
      const date = updatedIndexes[i]?.date?.split('T')[0];
      //PROMEDIOS
      if (updatedIndexes[i].informal && dbIndexes.find(x => x.currency === dolarId && x.date === date) == null) {
        const valueInformal = (updatedIndexes[i].informal.compra + updatedIndexes[i].informal.venta) / 2;
        await postRow(`indexes`, { date, currency: dolarId, value: valueInformal });
      };

      if (updatedIndexes[i].mep && dbIndexes.find(x => x.currency === mepId && x.date === date) == null) {
        const valueMep = (updatedIndexes[i].mep.compra + updatedIndexes[i].mep.venta) / 2;
        await postRow(`indexes`, { date, currency: mepId, value: valueMep });
      };

      if (updatedIndexes[i].oficial && dbIndexes.find(x => x.currency === oficialId && x.date === date) == null) {
        const valueOficial = (updatedIndexes[i].oficial.compra + updatedIndexes[i].oficial.venta) / 2;
        await postRow(`indexes`, { date, currency: oficialId, value: valueOficial });
      }
      //Compra-Venta
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

      //unitarios
      if (updatedIndexes[i].cac && dbIndexes.find(x => x.currency === cacId && x.date === date) == null) {
        const valueCAC = updatedIndexes[i].cac.general;

        await postRow(`indexes`, { date, currency: cacId, value: valueCAC });
      };
      if (updatedIndexes[i].uva && dbIndexes.find(x => x.currency === uvaId && x.date === date) == null) {
        const valueUVA = updatedIndexes[i].uva
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
      oficialCompraId,
      dolarId,
      mepId,
      oficialId
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
        await runQuery(`DELETE FROM indexes;
        ALTER SEQUENCE indexes_id_seq RESTART WITH 1;`);
        console.log('Se han eliminado los índices de la tabla...')
        res.body = await updateIndexes();
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
        res.body = await updateIndexes();
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
              cac: indexesDate?.find(indexObj => indexObj.currency.name === 'CAC')?.value,
              cacMinus2,
              uva: indexesDate?.find(indexObj => indexObj.currency.name === 'UVA')?.value,
              dolarCompra: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Compra')?.value,
              dolarVenta: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Venta')?.value,
              mepCompra: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar MEP Compra')?.value,
              mepVenta: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar MEP Venta')?.value,
              oficialCompra: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Oficial Compra')?.value,
              oficialVenta: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Oficial Venta')?.value,
              dolar: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar')?.value,
              mep: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar MEP')?.value,
              oficial: indexesDate?.find(indexObj => indexObj.currency.name === 'Dolar Oficial')?.value,
            }
          }).map((v, i, arr) => ({
            ...v,
            dolarCompra: v.dolarCompra || arr[i - 1]?.dolarCompra || arr[i - 2]?.dolarCompra || arr[i - 3]?.dolarCompra || arr[i - 4]?.dolarCompra,
            mepCompra: v.mepCompra || arr[i - 1]?.mepCompra || arr[i - 2]?.mepCompra || arr[i - 3]?.mepCompra || arr[i - 4]?.mepCompra,
            oficialCompra: v.oficialCompra || arr[i - 1]?.oficialCompra || arr[i - 2]?.oficialCompra || arr[i - 3]?.oficialCompra || arr[i - 4]?.oficialCompra,
            dolarVenta: v.dolarVenta || arr[i - 1]?.dolarVenta || arr[i - 2]?.dolarVenta || arr[i - 3]?.dolarVenta || arr[i - 4]?.dolarVenta,
            mepVenta: v.mepVenta || arr[i - 1]?.mepVenta || arr[i - 2]?.mepVenta || arr[i - 3]?.mepVenta || arr[i - 4]?.mepVenta,
            oficialVenta: v.oficialVenta || arr[i - 1]?.oficialVenta || arr[i - 2]?.oficialVenta || arr[i - 3]?.oficialVenta || arr[i - 4]?.oficialVenta,
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

  },
  {
    route: '/api/conversor',
    description: 'Receives a value from a specified currency and delivers the conversion of that value into another currency.',
    method: 'post',
    validations: {
      auth: null,
      body: {
        type: "object",
        properties: {
          from: {
            type: "object",
            properties: {
              currency: { type: "string" },
              //date: { type: "string" },
            }
          },
          to: {
            type: "object",
            properties: {
              currency: { type: "string" },
              date: { type: "string" },
            }
          },
          amount: { type: "number" }
        },
        required: ["from", "to", "amount"],
        additionalProperties: false
      },
    },
    action: async (req, res) => {

      try {
        const { from, to, amount } = req.body
        const indexes = (await getRows('indexes')).map(x => ({ ...x, date: (x.date.toISOString().slice(0, 10)) }));
        const currencies = await getRows('currencies');

        const currencyFrom = currencies?.find(c => c.name === from.currency);
        const currencyTo = currencies?.find(c => c.name === to.currency);

        if (!currencyFrom || !currencyTo) {
          return res.status(400).json({ error: "Invalid currency provided" });
        }
        const indexToCurrencyFrom = currencyFrom?.name === 'Peso' ? 1 : indexes?.find(i => i.date === to.date && i.currency === currencyFrom?.id);
        const indexTo = currencyTo?.name === 'Peso' ? 1 : indexes?.find(i => i.date === to.date && i.currency === currencyTo?.id);
        if (!indexToCurrencyFrom || !indexTo) {
          return res.status(400).json({ error: "Conversion rate not found for the provided date/currency" });
        }
        const result = (indexToCurrencyFrom * amount) / indexTo;

        return res.json({ result })


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
