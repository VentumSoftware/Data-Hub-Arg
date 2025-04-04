
import env from '../config/env.js';
import express from 'express';
import cors from 'cors';
//import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import path from 'path';
//import busboy from 'busboy';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const limitedArrStr = (arr, initialN = 10, endN = 0) => {
    let res = "";
    initialN = Math.min(initialN, arr.length);
    let initialArr = arr.slice(0, initialN);
    endN = Math.min(endN, arr.length - initialN);
    endN = endN > 0 ? endN : 0;
    let endArr = arr.slice(arr.length - endN, arr.length);
    let n = arr.length - initialArr.length - endN;
    let moreRows = n > 0 ? [`...${n} more rows`] : [];
    res += JSON.stringify([...initialArr, ...moreRows, ...endArr], null, 2);
    return res;
};

export const before = (app) => {
    const allowedToken = env.middleware.auth.token
    const addMiddleware = (app) => {

        app.use(cors({ origin: true, credentials: true }));
        app.use(express.static(path.join(__dirname, '..', 'uploads')));
        //console.log(path.join(__dirname, '..', 'uploads'))
        //app.use(express.static(path.join(__dirname, '..', 'landing')));
        // app.use(cookieParser());
        //"bodyParser" es un middleware que me ayuda a parsear los requests
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json({ limit: '20mb' }));
        app.use((err, req, res, next) => {
            if (err instanceof SyntaxError) {
                res.code = 400;
                res.body = 'Invalid Request Syntax';
            } else {
                throw err;
            }
            next();
        });
        //app.use(upload.any());
        return app;
    };
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers.authorization; // Obtener el header de autorización
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: 'Access denied: Missing or invalid token' });
        }

        const token = authHeader.split(" ")[1]; // Extraer el token del header
        if (token !== allowedToken) {
            return res.status(403).json({ error: 'Access denied: Invalid token' });
        }

        next();
    };
    const addUtils = (req, res, next) => {
        res.status(200);
        res.body = {};
        res.ok = () => (res.statusCode >= 200 && res.statusCode < 300);
        res.setCode = (code) => {
            res.statusCode = code;
            return this
        }

        next();
    };

    app = addMiddleware(app);
    app.use(authenticateToken); // Aplica la autenticación por token
    app.use(addUtils);
    //app.use(addReqData);

    return app;
};

export const after = (app) => {


    const errorHandler = (err, req, res, next) => {

        console.log('errorHandler', err.stack);
        res.code = 500;
        res.message = null;
        res.error = err.stack;
        log.error(err);
        next();
    };

   
  const respond = (req, res, next) => {
    res.send(res.body);
    next();
  };

    const logReq = async (req, res, next) => {
        const reqBody = JSON.stringify(req.body);
        const resBody = res?.body != null ? JSON.stringify(res.body) : null;
        const resFile = res?.metadata != null ? JSON.stringify(res.metadata) : null;
        //Document with request info that will be stored at the DB
        const getRequestData = async (req) => {

            const getPayloadType = (req) => {
                if (req.method === 'GET') return '';

                const contentType = Object.entries(req.headers).find(([key, value]) => key.toLowerCase() === 'content-type')?.[1]?.toLowerCase();

                if (contentType?.includes('multipart/form-data')) {
                    return 'multipart ';
                } else if (contentType?.includes('application/json')) {
                    return 'json ';
                } else if (contentType?.includes('application/x-www-form-urlencoded')) {
                    return 'form ';
                } else {
                    return contentType + ' ';
                }
            }

            var result = {
                //url: req.protocol + "://" + req.get('host') + req.originalUrl,
                ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                auth: req.auth,
                ts: Date.now(),
                remoteAddress: req.ip,
                url: req.url,
                method: req.method,
                cookies: req.cookies,
                headers: req.headers,
                params: req.params,
                query: req.query,
                body: req.body,
                files: req.files,
                protocol: req.protocol.toUpperCase(),
                payloadType: getPayloadType(req),
            };

            return result;
        };

        //Logs request data (settings from enviroment variables)
        const logRequest = async (data) => {

            function getDateTimeWithMilliseconds(ts) {
                if (ts == null) return null;
                const date = new Date(ts);
                const milliseconds = date.getMilliseconds();
                const dateTimeWithoutMilliseconds = date.toLocaleString('en-GB', { timeZone: 'UTC' });


                const formattedMilliseconds = milliseconds.toString().padStart(3, '0');
                const dateTimeWithMilliseconds = `${dateTimeWithoutMilliseconds}.${formattedMilliseconds}`;

                return dateTimeWithMilliseconds;
            }

            const reqLogOptions = env.middleware.log.req;
            const resLogOptions = env.middleware.log.res;

            let logStr = `\x1b[35m>>\x1b[0m\x1b[32m ${data.protocol} ${data?.payloadType}\x1b[0m\x1b[36m${data.method}\x1b[0m \x1b[33m${data.url}\x1b[0m ${req.end - req.start}ms ${req.uuid}\x1b[0m`

            //RESQUEST
            if (eval(reqLogOptions.req)) {
                logStr += (`
\x1b[35mREQ\x1b[0m IP \x1b[33m${data.ip}\x1b[0m at ${getDateTimeWithMilliseconds(req.start)} (UTC)\x1b[0m`);
                if (eval(reqLogOptions?.headers)) logStr += (` 
  Headers: ${JSON.stringify(data.headers, null, 4)}`);
                if (reqLogOptions?.auth === 'oneline') logStr += (`
  Auth: ${JSON.stringify({ valid: data?.auth?.jwt.valid, expiration: getDateTimeWithMilliseconds(data?.auth?.jwt?.decodedJWT?.payload?.expiration), id: data?.auth?.jwt?.decodedJWT?.payload?.id, email: data?.auth?.user?.email, rols: data?.auth?.rols?.map(x => x.name) })}`);
                else if (eval(reqLogOptions.auth)) logStr += (`
  Auth: ${JSON.stringify(data.auth, null, 4)}`);
                if (reqLogOptions?.body === 'oneline') logStr += (`
  Body: ${reqBody?.substring(0, 80)}${reqBody && reqBody.length > 80 ? '...' : ''} (Length ${reqBody?.length})`);
                else if (eval(reqLogOptions.body)) logStr += (`
  Body: ${Array.isArray(data.body) ? limitedArrStr(data.body, 5) : JSON.stringify(data.body, null, 4)}`);
            }
            //RESPONSE
            if (eval(resLogOptions?.res) || true) {
                logStr += (`
\x1b[35mRES\x1b[0m \x1b[32m${res.statusCode} \x1b[0m${getDateTimeWithMilliseconds(req.end)} (UTC)\x1b[0m`);
                if (eval(resLogOptions?.headers)) logStr += (` 
  Headers: ${JSON.stringify(res.getHeaders(), null, 4)}`);
                if (resLogOptions?.auth === 'oneline') logStr += (`
  Auth: ${JSON.stringify({ valid: res?.auth?.jwt?.valid, id: res?.auth?.personaId, email: res?.auth?.jwt?.payload.email, roles: res?.auth?.roles })}`);
                else if (eval(resLogOptions?.auth)) logStr += (`
  Auth: ${JSON.stringify(res.auth, null, 2)}`);
                if (resFile) {
                    if (resLogOptions?.body === 'oneline') logStr += (`
  File: ${resFile?.substring(0, 120)}${resFile && resFile.length > 120 ? '...' : ''} (Length ${resFile?.length})`);
                    else if (eval(resLogOptions?.body)) logStr += (`
  File: ${resFile}`);
                } else {
                    if (resLogOptions?.body === 'oneline') logStr += (`
  Body: ${resBody?.substring(0, 120)}${resBody && resBody.length > 120 ? '...' : ''} (Length ${resBody?.length})`);
                    else if (eval(resLogOptions?.body)) logStr += (`
  Body: ${Array.isArray(res.body) ? limitedArrStr(res.body, 5) : JSON.stringify(res.body, null, 4)}`);
                }
            }
            log.info(`${logStr}\n`);
        };

        let reqData = await getRequestData(req);
        //if (reqData) await logRequest(reqData);
        next();
    };

    //app.use(refreshAuth);
    app.use(errorHandler);
    app.use(respond);
    app.use(logReq);
    return app;
};
