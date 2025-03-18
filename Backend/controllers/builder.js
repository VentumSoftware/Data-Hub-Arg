import { log } from '../lib/index.js';
import { z, ZodError } from 'zod';
import Ajv from "ajv";
import express from 'express';

const castObjTypes = (obj, schema) => {
  return Object.entries(obj).reduce((p, [k, v]) => {
    try {
      if (!schema[k]) return p;
      if (schema[k].type === 'integer') p[k] = parseInt(v);
      else if (schema[k].type === 'number') p[k] = Number(v);
      else if (schema[k].type === 'boolean') p[k] = v === 'true';
      else if (schema[k].type === 'array') p[k] = castObjTypes(Object.parse(v), schema[k].items);
      else if (schema[k].type === 'object') p[k] = castObjTypes(Object.parse(v), schema[k].properties);
      else if (schema[k].type === 'string') p[k] = v.toString();
      else p[k] = v;

    } catch (error) {
      log.error('castObjTypes: ' + JSON.stringify({ k, v, schema, error }, null, 2));
    }
    return p;
  }, {});

};
/**
* @param {object} schema
* @returns {object} returns ajv validator
*/
const getValidator = (schema) => {
  const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}
  ajv.addKeyword({
    keyword: "isFunction",
    validate: (data) => {
      return typeof data === "function";
    },
    metaSchema: {
      type: "boolean",
    }
  });
  return ajv.compile(schema);
};
/**
* @param {object} req -> request
* @param {object} res -> response
* @param {function || object} criteria -> function that evaluates auth JWT or object with auth criteria (JSON schema)
* @returns {Promise<[req:object,res:object]>} returns updated [req,res]
*/
export const testAuth = async (req, res, criteria) => {
  let valid = false;
  const obj = req?.auth;
  try {
    if (typeof criteria === 'function')
      valid = await criteria(obj, req);
    else if (typeof criteria === 'object')
      valid = getValidator(criteria)(obj);
    else
      throw new Error('Invalid auth criteria');
  } catch (error) {
    log.error(error);
    valid = false;
  }

  if (!valid) {
    log.warn(`Auth test failed: ` + JSON.stringify({ criteria, obj }, null, 2));
    res.status(401).body.error = "Unauthorized";
  }

  return [req, res];
};
/**
* @param {object} req -> request
* @param {object} res -> response
* @param {function} criteria -> function that evaluates url query
* @returns {Promise<[req:object,res:object]} returns updated [req,res]
*/
export const testQuery = async (req, res, criteria) => {
  let valid = false;
  let obj = req?.query;
  try {
    if (typeof criteria === 'function')
      valid = await criteria(obj);
    else if (typeof criteria === 'object') {
      obj = castObjTypes(obj, criteria?.properties);
      valid = getValidator(criteria)(obj);
    }
    else
      throw new Error('Invalid query criteria');
  } catch (error) {
    log.error(error);
    valid = false;
  }

  if (!valid) {
    log.warn(`Test query failed: ` + JSON.stringify({ criteria, obj }, null, 2));
    res.status(400).body.error = "Invalid query format";
  }

  return [req, res];
};
/**
* @param {object} req -> request
* @param {object} res -> response
* @param {function || object} criteria -> function that evaluates request body
* @returns {Promise<[req:object,res:object]>} returns updated [req,res]
*/
export const testBody = async (req, res, criteria) => {
  let valid = false;
  try {
    if (typeof criteria === 'function')
      valid = await criteria(req?.body);
    else if (typeof criteria === 'object')
      valid = getValidator(criteria)(req?.body);
    else
      throw new Error('Invalid body criteria');
  } catch (error) {
    log.error(error);
    valid = false;
  }
  if (!valid) {
    log.warn(`Test body failed: ` + JSON.stringify({ criteria, obj: req?.body }, null, 2));
    res.status(400).body.error = "Invalid body format";
  }
  return [req, res];
};
export const testZbody = async (req, res, criteria) => {

  const zObject = z.object(criteria);
  try {
    zObject.parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('Zod error')
      //res.status(422).json(error);
      res.status(422).body = error.issues.map(issue => ({ path: issue.path, message: issue.message }));
      //res.status(400).body.error = "Invalid body formatZod";
    } else {
      console.log(error);
      res.status(500);
    }
  }
  return [req, res];
};
/**
* @param {object} req -> request
* @param {object} res -> response
* @param {function} criteria -> function that evaluates each body row
* @returns {Promise<[req:object,res:object]>} returns updated [req,res]
*/
export const testBodyRows = async (req, res, criteria) => {
  let valid = false;
  try {
    valid = await req.body.reduce(async (p, x) => p && await criteria(x), true);
  } catch (error) {
    log.error(error);
    valid = false;
  }

  if (!valid) {
    log.warn(`Test body rows failed: ` + JSON.stringify({ criteria, obj: req.body }, null, 2));
    res.status(400).body.error = "Invalid body format";
  }
  return [req, res];
};

/**
* @param {object} req -> request
* @param {object} res -> response
* @param {function || object} criteria -> function that evaluates url params
* @returns {Promise<[req:object,res:object]} returns updated [req,res]
*/
export const testParams = async (req, res, criteria) => {
  let valid = false;
  try {
    if (typeof criteria === 'function')
      valid = await criteria(req?.params);
    else if (typeof criteria === 'object')
      valid = getValidator(criteria)(req?.params);
    else
      throw new Error('Invalid params criteria');
  } catch (error) {
    log.error(error);
    valid = false;
  }

  if (!valid) {
    log.warn(`Test params failed: ` + criteria);
    res.status(400).body.error = "Invalid URL params";
  }
  return [req, res];
};
/**
* @param {string} str -> string to convert
* @returns {string} string converted to 'PascalCase' 
*/
export const toPascalCase = str => {

  str[0].toUpperCase() + str.slice(1);
};
/**
* @param {string} str -> string to convert
* @returns {string} string converted to 'camelCase' 
*/
export const toCamelCase = str => str[0].toLowerCase() + str.slice(1);
/**
* @param {object} obj -> object
* @returns {object} returns object with all keys converted to 'PascalCase'
*/
export const keysToPC = obj => Object.entries(obj).reduce((p, x) => ({ ...p, [toPascalCase(x[0])]: x[1] }), {});
/**
* @param {object} obj -> object
* @returns {object} returns object with all keys converted to 'camelCase'
*/
export const keysToCC = obj => Object.entries(obj).reduce((p, x) => ({ ...p, [toCamelCase(x[0])]: x[1] }), {});
/**
* @param {object} obj -> input
* @returns {[]} returns input as array 
*/
export const toArray = obj => Array.isArray(obj) ? [...obj] : [obj];
/**
* @param {object} arr -> input array
* @param {function} criteria -> function that evaluates each array row
* @returns {[object,object]} returns updated [req,res]
*/
export const testArr = (arr, criteria) => {
  let valid = false;
  try {
    valid = arr.reduce((p, x) => p && criteria(x), true);
  } catch (error) {
    log.error(error);
    valid = false;
  }
  return valid;
};
/**
* @param {object} req -> request
* @param {object} res -> responserow
* @returns {[object,object]} returns updated [req,res]
*/
export const bodyToArray = (req, res) => {
  req.body = toArray(req.body);
}

export const filesToArray = (req, res) => {
  req.files = toArray(req.files);
}

export const validEmail = (email) => {
  var re = /\S+@\S+\.\S+/;
  return re.test(email);
};

/**
* @param {object} mapFrom -> request
* @param {object} res -> response
* @returns {[object,object]} returns updated [req,res]
*/
export const mapRows = (req, res, baseObj) => {
  try {
    if (!Array.isArray(req.body)) throw new Error('Body is not an array');
    let bodyAux = [];
    req.body.forEach((row, i) => {
      if (typeof (req.body) !== 'object') throw new Error('Row is not an object');
      let newRow = {};
      (baseObj).forEach(key => row[key] !== undefined ? newRow[key] = row[key] : null);
      bodyAux.push(newRow);
    });
    req.body = bodyAux;
  } catch (error) {
    log.warn(`MapRows failed: ` + JSON.stringify(baseObj) + error);
    res.status(400).body.error = "Invalid body format";
  }
  return [req, res];
}

export const build = (endpoints) => {

  //TODO: Swagger (open api) documentation
  //TODO: Add support for file uploads
  //TODO: Add support for file downloads
  //TODO: Download "$ref": "https://json-schema.org/draft/2020-12/schema" and use it to validate the schema

  //Create a router for each endpoint method
  const patchEndpoints = (endpoints) => endpoints.reduce((p, x) => {
    if (Array.isArray(x.method)) {
      return p.concat(x.method.map(m => ({ ...x, method: m })));
    } else {
      x.method = x.method.toLowerCase();
      if (x.method === '*') {
        return p.concat(['get', 'post', 'put', 'patch', 'delete'].map(m => ({ ...x, method: m })));
      } else {
        return p.concat(x);
      }
    };
  }, []);

  const validateEndpoints = async (endpoints) => {

    const getValidator = (schema) => {
      const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}
      ajv.addKeyword({
        keyword: "isFunction",
        validate: (data) => {
          return typeof data === "function";
        },
        metaSchema: {
          type: "boolean",
        }
      });
      return ajv.compile(schema);
    };

    const validator = getValidator({
      type: "object",
      properties: {
        route: {
          type: "string"
        },
        description: {
          type: "string"
        },
        method: {
          type: "string",
          enum: ['get', 'post', 'put', 'patch', 'delete']
        },
        validate: {
          type: "object",
          properties: {
            auth: {},
            query: {},
            body: {},
            params: {}
          }
        },
        action: {}
      },
      required: ["route", "method", "action"]
    });

    endpoints.forEach(endpoint => {
      if (!validator(endpoint)) {
        throw new Error('Invalid endpoint definition: ' + JSON.stringify(validator.errors, null, 2));
      }

    });

  };

  const buildRouter = (endpoints) => {

    const validate = async (req, res, validations) => {
      if (validations) {
        const { auth, query, body, params } = validations;

        if (auth)
          [req, res] = await testAuth(req, res, auth);
        if (query && res.ok())
          [req, res] = await testQuery(req, res, query);
        if (body && res.ok())
          [req, res] = await testBody(req, res, body);
        if (params && res.ok())
          [req, res] = await testParams(req, res, params);
      }
      return res.ok();
    };

    const router = express.Router();

    endpoints.forEach(endpoint => {
      const { route, method, action, validations } = endpoint;
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method))
        throw new Error('Invalid method: ' + method + ' in endpoint: ' + route);

      router[method](route, async (req, res, next) => {
        if (await validate(req, res, validations))
          try {
            await action(req, res)
          } catch (error) {
            log.error(error)
          }
        next();
      });
      router.all('*', (err, req, res, next) => log.error(err) && res.send({ error: err.stack }));
    });

    return router;
  };

  endpoints = patchEndpoints(endpoints);
  validateEndpoints(endpoints);
  return buildRouter(endpoints);
}

export default {
  mapRows, testAuth, testQuery, filesToArray, testBody, testBodyRows, testParams, toPascalCase, toCamelCase, keysToPC,
  keysToCC, toArray, testArr, bodyToArray, validEmail, testZbody
};