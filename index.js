const JsonRpcError = require('./JsonRpcError');

const REQUEST = {
  method: 'POST',
};

const HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const BODY = {
  params: [],
  jsonrpc: '1.0',
};

/**
 * Create JsonRPC authorization header from RPC credentials.
 *
 * @param {String} rpcuser
 * @param {String} rpcpassword
 * @returns {{Authorization: string}}
 */
const createAuthorizationHeaders = (rpcuser, rpcpassword) => ({
  Authorization: `Basic ${new Buffer(rpcuser + ':' + rpcpassword).toString(
    'base64'
  )}`,
});

/**
 * Ensure params are an array form.
 *
 * @param {Array|*} params
 * @returns {Array}
 */
const toArray = params => (Array.isArray(params) ? params : [params]);

/**
 * Build the JsonRPC endpoint from scheme, host and port.
 *
 * @param {String} rpcscheme
 * @param {String} rpchost
 * @param {String} rpcport
 * @returns {String}
 */
const buildEndpoint = ({
  rpcscheme = 'http',
  rpchost = '127.0.0.1',
  rpcport = 8332,
}) => `${rpcscheme}://${rpchost}:${rpcport}`;

/**
 * Generate a string id for given method and params.
 *
 * @param {String} method
 * @param {Array} params
 * @returns {string}
 */
const generateId = (method, params = []) =>
  `${method}_${params.join('_')}_${s4()}`;

/**
 * Generate a random string of 4 characters, containing letters and numbers.
 *
 * @returns {string}
 */
const s4 = () =>
  Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);

/**
 * Create an error handler for given method.
 *
 * @param {Object} context
 * @returns {Function}
 */
const createErrorHandler = context =>
  /**
   * Throw an `Error` if the response is not in `ok` state.
   * Return the `Response` unchanged otherwise.
   *
   * @param {Response} response
   * @returns {Response}
   * @throws Error
   */
  response => {
    if (!response.ok) {
      switch (response.status) {
        case 404:
          throw new JsonRpcError('Method nod found.', {
            ...context,
            code: 404,
          });
        case 500:
          return response;
        default:
          throw new JsonRpcError(response.statusText, {
            ...context,
            code: response.status,
          });
      }
    }

    return response;
  };

/**
 * Shorthand method, transform the `Response` to a Json response object.
 *
 * @param {Response} response
 * @returns {Object}
 */
const toJson = response => response.json();

/**
 * Throw an error if the Json response object contains a `JsonRPC` error.
 * Return the Json response object unchanged otherwise.
 *
 * @param {Object} context
 * @returns {Function}
 */
const handleJsonError = (context = {}) =>
  /**
   * @param {Object} jsonResponse
   * @returns {Object}
   * @throws Error
   */
  jsonResponse => {
    if (jsonResponse.error) {
      const { message, code } = jsonResponse.error;
      throw new JsonRpcError(message, {
        ...context,
        code,
      });
    }

    return jsonResponse;
  };

/**
 * Return the result key of the Json response object.
 *
 * @param {Object} jsonResponse
 * @returns {Object}
 */
const toResult = jsonResponse => jsonResponse.result;

/**
 * Create the JsonRPC call function for given endpoint and credentials.
 *
 * @param {String} rpcscheme
 * @param {string} rpchost
 * @param {Number|String} rpcport
 * @param {String} rpcuser
 * @param {String} rpcpassword
 * @returns {function(*=, ...[*]=): Promise<Object>}
 */
const createCall = ({
  rpcscheme = 'http',
  rpchost = '127.0.0.1',
  rpcport = 8332,
  rpcuser,
  rpcpassword,
}) => {
  const endpoint = buildEndpoint({ rpcscheme, rpchost, rpcport });
  const request = {
    ...REQUEST,
    headers: {
      ...HEADERS,
      ...createAuthorizationHeaders(rpcuser, rpcpassword),
    },
  };

  return (method, ...params) => {
    const arrayParams = toArray(params);
    const context = {
      id: generateId(method, arrayParams),
      method,
      params: arrayParams,
    };

    return fetch(endpoint, {
      ...request,
      body: JSON.stringify({
        ...BODY,
        ...context,
      }),
    })
      .then(createErrorHandler({ ...context, rpcuser, endpoint }))
      .then(toJson)
      .then(handleJsonError({ ...context, rpcuser, endpoint }))
      .then(toResult);
  };
};

module.exports = {
  REQUEST,
  HEADERS,
  BODY,
  createAuthorizationHeaders,
  toArray,
  buildEndpoint,
  generateId,
  s4,
  createErrorHandler,
  toJson,
  handleJsonError,
  toResult,
  createCall,
};
