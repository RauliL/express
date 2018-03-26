/*!
 * gophress
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * Copyright(c) 2018 Rauli Laine
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

var Buffer = require('safe-buffer').Buffer
var deprecate = require('depd')('express');
var escapeHtml = require('escape-html');
var isAbsolute = require('./utils').isAbsolute;
var onFinished = require('on-finished');
var path = require('path');
var statuses = require('statuses')
var merge = require('utils-merge');
var normalizeType = require('./utils').normalizeType;
var normalizeTypes = require('./utils').normalizeTypes;
var send = require('send');
var extname = path.extname;
var mime = send.mime;
var resolve = path.resolve;

/**
 * Response class.
 * @public
 */
class Response {
  // TODO: locals

  constructor(req) {
    this.req = req;
    this.connection = this.req.connection;
  }

  /**
   * Set status `code`.
   *
   * Due to limitations of the Gopher protocol, this method actually doesn't do
   * anything.
   *
   * @param {Number} code
   * @return {Response}
   * @public
   */
  status() {
    return this;
  }

  /**
   * Set Link header field with the given `links`.
   *
   * Due to limitations of the Gopher protocol, this method doesn't actually do
   * anything.
   */
  links() {
    return this;
  }

  /**
   * Send a response.
   *
   * Examples:
   *
   *     res.send(Buffer.from('wahoo'));
   *     res.send({ some: 'json' });
   *     res.send('<p>some html</p>');
   *
   * @param {string|number|boolean|object|Buffer} body
   * @public
   */
  send(body) {
    let chunk = body;
    const req = this.req;

    // settings
    const app = this.app;

    // allow status / body
    if (arguments.length === 2) {
      // res.send(body, status) backwards compat
      if (typeof arguments[0] !== 'number' && typeof arguments[1] === 'number') {
        deprecate('res.send(body, status): Use res.status(status).send(body) instead');
      } else {
        deprecate('res.send(status, body): Use res.status(status).send(body) instead');
        chunk = arguments[1];
      }
    }

    // disambiguate res.send(status) and res.send(status, num)
    // TODO: Remove this feature as Gopher does not support status codes.
    if (typeof chunk === 'number' && arguments.length === 1) {
      deprecate('res.send(status): Use res.sendStatus(status) instead');
      chunk = statuses[chunk]
    }

    switch (typeof chunk) {
      case 'boolean':
      case 'number':
      case 'object':
        if (chunk === null) {
          chunk = '';
        } else if (!Buffer.isBuffer(chunk)) {
          return this.json(chunk);
        }
        break;
    }

    // respond
    this.end(chunk);

    return this;
  }

  /**
   * Send JSON response.
   *
   * Examples:
   *
   *     res.json(null);
   *     res.json({ user: 'tj' });
   *
   * @param {string|number|boolean|object} obj
   * @public
   */
  json(obj) {
    let val = obj;

    // allow status / body
    if (arguments.length === 2) {
      // res.json(body, status) backwards compat
      if (typeof arguments[1] === 'number') {
        deprecate('res.json(obj, status): Use res.status(status).json(obj) instead');
      } else {
        deprecate('res.json(status, obj): Use res.status(status).json(obj) instead');
        val = arguments[1];
      }
    }

    // settings
    var app = this.app;
    var escape = app.get('json escape')
    var replacer = app.get('json replacer');
    var spaces = app.get('json spaces');
    var body = stringify(val, replacer, spaces, escape)

    return this.send(body);
  }

  /**
   * Send JSON response with JSONP callback support.
   *
   * Examples:
   *
   *     res.jsonp(null);
   *     res.jsonp({ user: 'tj' });
   *
   * @param {string|number|boolean|object} obj
   * @public
   */
  jsonp(obj) {
    let val = obj;

    // allow status / body
    if (arguments.length === 2) {
      // res.json(body, status) backwards compat
      if (typeof arguments[1] === 'number') {
        deprecate('res.jsonp(obj, status): Use res.status(status).json(obj) instead');
      } else {
        deprecate('res.jsonp(status, obj): Use res.status(status).jsonp(obj) instead');
        val = arguments[1];
      }
    }

    // settings
    var app = this.app;
    var escape = app.get('json escape')
    var replacer = app.get('json replacer');
    var spaces = app.get('json spaces');
    var body = stringify(val, replacer, spaces, escape)
    var callback = this.req.query[app.get('jsonp callback name')];

    // fixup callback
    if (Array.isArray(callback)) {
      callback = callback[0];
    }

    // jsonp
    if (typeof callback === 'string' && callback.length !== 0) {
      // restrict callback charset
      callback = callback.replace(/[^\[\]\w$.]/g, '');

      // replace chars not allowed in JavaScript that are in JSON
      body = body
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

      // the /**/ is a specific security mitigation for "Rosetta Flash JSONP abuse"
      // the typeof check is just to reduce client error noise
      body = '/**/ typeof ' + callback + ' === \'function\' && ' + callback + '(' + body + ');';
    }

    return this.send(body);
  }

  /**
   * Send given HTTP status code.
   *
   * Sets the response status to `statusCode` and the body of the
   * response to the standard description from node's http.STATUS_CODES
   * or the statusCode number if no description.
   *
   * TODO: Remove this method as it doesn't make any sense with Gopher
   * protocol.
   *
   * Examples:
   *
   *     res.sendStatus(200);
   *
   * @param {number} statusCode
   * @public
   */
  sendStatus(statusCode) {
    const body = statuses[statusCode] || String(statusCode)

    return this.send(body);
  }

  /**
   * Transfer the file at the given `path`.
   *
   * Automatically sets the _Content-Type_ response header field.
   * The callback `callback(err)` is invoked when the transfer is complete
   * or when an error occurs. Be sure to check `res.sentHeader`
   * if you wish to attempt responding, as the header and some data
   * may have already been transferred.
   *
   * Options:
   *
   *   - `maxAge`   defaulting to 0 (can be string converted by `ms`)
   *   - `root`     root directory for relative filenames
   *   - `headers`  object of headers to serve with file
   *   - `dotfiles` serve dotfiles, defaulting to false; can be `"allow"` to
   *     send them
   *
   * Other options are passed along to `send`.
   *
   * Examples:
   *
   *  The following example illustrates how `res.sendFile()` may
   *  be used as an alternative for the `static()` middleware for
   *  dynamic situations. The code backing `res.sendFile()` is actually
   *  the same code, so HTTP cache support etc is identical.
   *
   *     app.get('/user/:uid/photos/:file', function(req, res){
   *       var uid = req.params.uid
   *         , file = req.params.file;
   *
   *       req.user.mayViewFilesFrom(uid, function(yes){
   *         if (yes) {
   *           res.sendFile('/uploads/' + uid + '/' + file);
   *         } else {
   *           res.send(403, 'Sorry! you cant see that.');
   *         }
   *       });
   *     });
   *
   * @public
   */
  sendFile(path, options, callback) {
    let done = callback;
    const req = this.req;
    const res = this;
    const next = req.next;
    let opts = options || {};

    if (!path) {
      throw new TypeError('path argument is required to res.sendFile');
    }

    // support function as second arg
    if (typeof options === 'function') {
      done = options;
      opts = {};
    }

    if (!opts.root && !isAbsolute(path)) {
      throw new TypeError('path must be absolute or specify root to res.sendFile');
    }

    // create file stream
    const pathname = encodeURI(path);
    const file = send(req, pathname, opts);

    // transfer
    sendfile(res, file, opts, function (err) {
      if (done) return done(err);
      if (err && err.code === 'EISDIR') return next();

      // next() all but write errors
      if (err && err.code !== 'ECONNABORTED' && err.syscall !== 'write') {
        next(err);
      }
    });
  }

  /**
   * Transfer the file at the given `path` as an attachment.
   *
   * Optionally providing an alternate attachment `filename`,
   * and optional callback `callback(err)`. The callback is invoked
   * when the data transfer is complete, or when an error has
   * ocurred. Be sure to check `res.headersSent` if you plan to respond.
   *
   * Optionally providing an `options` object to use with `res.sendFile()`.
   * This function will set the `Content-Disposition` header, overriding
   * any `Content-Disposition` header passed as header options in order
   * to set the attachment and filename.
   *
   * This method uses `res.sendFile()`.
   *
   * @public
   */
  download(path, filename, options, callback) {
    let done = callback;
    let name = filename;
    let opts = options || null

    // support function as second or third arg
    if (typeof filename === 'function') {
      done = filename;
      name = null;
      opts = null
    } else if (typeof options === 'function') {
      done = options
      opts = null
    }

    // merge user-provided options
    opts = Object.create(opts)

    // Resolve the full path for sendFile
    const fullPath = resolve(path);

    // send file
    return this.sendFile(fullPath, opts, done)
  }

  /**
   * Set _Content-Type_ response header with `type` through `mime.lookup()`
   * when it does not contain "/", or set the Content-Type to `type`
   * otherwise.
   *
   * Because of limitations of Gopher protocol, this method doesn't actually do
   * anything.
   *
   * @param {String} type
   * @return {ServerResponse} for chaining
   * @public
   */
  contentType() {
    return this;
  }

  /**
   * Alias of `Response#contentType()`.
   */
  type(type) {
    return this.contentType(type);
  }

  /**
   * Set _Content-Disposition_ header to _attachment_ with optional `filename`.
   *
   * Due to limitations of Gopher protocol, this method doesn't actually do
   * anything.
   *
   * @param {String} filename
   * @return {ServerResponse}
   * @public
   */
  attachment() {
    return this;
  }

  /**
   * Append additional header `field` with value `val`.
   *
   * Due to limitations of Gopher protocol, this method doesn't actually do
   * anything.
   *
   * @param {String} field
   * @param {String|Array} val
   * @return {ServerResponse} for chaining
   * @public
   */
  append() {
    return this;
  }

  /**
   * Set header `field` to `val`, or pass an object of header fields.
   *
   * Due to limitations of Gopher protocol, this method doesn't actually do
   * anything.
   */
  set() {
    return this;
  }

  /**
   * Alias of `Request#set()`.
   */
  header(field, val) {
    return this.set(field, val);
  }

  /**
   * Get value for header `field`.
   *
   * Due to limitations of Gopher protocol, this method will always return
   * `undefined`.
   */
  get() {
    return undefined;
  }

  /**
   * Clear cookie `name`.
   *
   * Due to limitations of Gopher protocol, this method doesn't actually do
   * anything.
   *
   * @param {String} name
   * @param {Object} [options]
   * @return {ServerResponse} for chaining
   * @public
   */
  clearCookie() {
    return this;
  }

  /**
   * Set cookie `name` to `value`, with the given `options`.
   *
   * Due to limitations of Gopher protocol, this method doesn't actually do
   * anything.
   *
   * @param {String} name
   * @param {String|Object} value
   * @param {Object} [options]
   * @return {ServerResponse} for chaining
   * @public
   */
  cookie() {
    return this;
  }

  /**
   * Set the location header to `url`.
   *
   * Due to limitations of Gopher protocl, this method doesn't actually do
   * anything.
   *
   * @param {String} url
   * @return {ServerResponse} for chaining
   * @public
   */
  location() {
    return this;
  }

  /**
   * Redirect to the given `url` with optional response `status`
   * defaulting to 302.
   *
   * Due to limitations of Gopher protocol, this method currently does nothing.
   *
   * @public
   */
  redirect() {}

  /**
   * Add `field` to Vary. If already present in the Vary set, then
   * this call is simply ignored.
   *
   * Due to limitations of Gopher protocol, this method currently doesn't do
   * anything.
   *
   * @param {Array|String} field
   * @return {ServerResponse} for chaining
   * @public
   */
  vary() {
    return this;
  }

  /**
   * Render `view` with the given `options` and optional callback `fn`.
   * When a callback function is given a response will _not_ be made
   * automatically, otherwise a response of _200_ and _text/html_ is given.
   *
   * Options:
   *
   *  - `cache`     boolean hinting to the engine it should cache
   *  - `filename`  filename of the view being rendered
   *
   * @public
   */
  render(view, options, callback) {
    const app = this.req.app;
    let done = callback;
    let opts = options || {};
    const req = this.req;

    // support callback function as second arg
    if (typeof options === 'function') {
      done = options;
      opts = {};
    }

    // merge res.locals
    opts._locals = this.locals;

    // default callback to respond
    done = done || ((err, str) => {
      if (err) return req.next(err);
      this.send(str);
    });

    // render
    app.render(view, opts, done);
  }

  // Partially implement Node.js writable stream.

  end(chunk, encoding, callback) {
    if (typeof chunk === 'function') {
      callback = chunk;
      chunk = null;
    } else if (typeof encoding === 'function') {
      callback = encoding;
      encoding = null;
    }

    let uncork;
    if (chunk) {
      if (typeof chunk !== 'string' && !(chunk instanceof Buffer)) {
        throw new TypeError('Chunk must be either string or buffer');
      }
      this.connection.cork();
      uncork = true;
      this.connection.end(chunk, encoding, callback);
    }

    if (uncork) {
      this.connection.uncork();
    }

    return this;
  }
}

module.exports = Response;

// pipe the send file stream
function sendfile(res, file, options, callback) {
  var done = false;
  var streaming;

  // request aborted
  function onaborted() {
    if (done) return;
    done = true;

    var err = new Error('Request aborted');
    err.code = 'ECONNABORTED';
    callback(err);
  }

  // directory
  function ondirectory() {
    if (done) return;
    done = true;

    var err = new Error('EISDIR, read');
    err.code = 'EISDIR';
    callback(err);
  }

  // errors
  function onerror(err) {
    if (done) return;
    done = true;
    callback(err);
  }

  // ended
  function onend() {
    if (done) return;
    done = true;
    callback();
  }

  // file
  function onfile() {
    streaming = false;
  }

  // finished
  function onfinish(err) {
    if (err && err.code === 'ECONNRESET') return onaborted();
    if (err) return onerror(err);
    if (done) return;

    setImmediate(function () {
      if (streaming !== false && !done) {
        onaborted();
        return;
      }

      if (done) return;
      done = true;
      callback();
    });
  }

  // streaming
  function onstream() {
    streaming = true;
  }

  file.on('directory', ondirectory);
  file.on('end', onend);
  file.on('error', onerror);
  file.on('file', onfile);
  file.on('stream', onstream);
  onFinished(res, onfinish);

  // pipe
  file.pipe(res);
}

/**
 * Stringify JSON, like JSON.stringify, but v8 optimized, with the
 * ability to escape characters that can trigger HTML sniffing.
 *
 * @param {*} value
 * @param {function} replaces
 * @param {number} spaces
 * @param {boolean} escape
 * @returns {string}
 * @private
 */

function stringify (value, replacer, spaces, escape) {
  // v8 checks arguments.length for optimizing simple call
  // https://bugs.chromium.org/p/v8/issues/detail?id=4730
  var json = replacer || spaces
    ? JSON.stringify(value, replacer, spaces)
    : JSON.stringify(value);

  if (escape) {
    json = json.replace(/[<>&]/g, function (c) {
      switch (c.charCodeAt(0)) {
        case 0x3c:
          return '\\u003c'
        case 0x3e:
          return '\\u003e'
        case 0x26:
          return '\\u0026'
        default:
          return c
      }
    })
  }

  return json
}
