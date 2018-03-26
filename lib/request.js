/*!
 * gophress
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * Copyright(c) 2018 Rauli Laine
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

const isIP = require('net').isIP;

/**
 * Request class.
 * @public
 */
class Request {
  // TODO: hostname
  // TODO: url
  // TODO: params
  // TODO: query

  constructor (app, connection, selector) {
    this.app = app;
    this.connection = connection;
    this.selector = selector;
  }

  /**
   * Return the protocol string "gopher" or "gophers" when requested with TLS.
   *
   * If you're running behind a reverse proxy that supplies gophers for you
   * this may be enabled.
   *
   * @return {String}
   * @public
   */
  get protocol () {
    return this.connection.encrypted ? 'gophers' : 'gopher';
  }

  /**
   * Short-hand for:
   *
   *    req.protocol === 'gophers'
   *
   * @return {Boolean}
   * @public
   */
  get secure () {
    return this.protocol === 'gophers';
  }

  /**
   * Return the remote address from the trusted proxy.
   *
   * Due to limitations of Gopher protocol, this method will always return
   * remote address on the socket.
   *
   * @return {String}
   * @public
   */
  get ip () {
    return this.connection.remoteAddress;
  }

  /**
   * When "trust proxy" is set, trusted proxy addresses + client.
   *
   * Due to limitations of Gopher protocol, this method will always just return
   * the remote address on the socket.
   *
   * @return {Array}
   * @public
   */
  get ips () {
    return [this.connection.remoteAddress];
  }

  /**
   * Return subdomains as an array.
   *
   * Subdomains are the dot-separated parts of the host before the main domain of
   * the app. By default, the domain of the app is assumed to be the last two
   * parts of the host. This can be changed by setting "subdomain offset".
   *
   * For example, if the domain is "tobi.ferrets.example.com":
   * If "subdomain offset" is not set, req.subdomains is `["ferrets", "tobi"]`.
   * If "subdomain offset" is 3, req.subdomains is `["tobi"]`.
   *
   * @return {Array}
   * @public
   */
  get subdomains () {
    const hostname = this.hostname;

    if (!hostname) return [];

    const offset = this.app.get('subdomain offset');
    const subdomains = !isIP(hostname)
      ? hostname.split('.').reverse()
      : [hostname];

    return subdomains.slice(offset);
  }

  /**
   * Returns the part portion of the URL to which the request was made at.
   *
   * @return {string}
   * @public
   */
  get path () {
    const idx = this.selector.indexOf('?');

    return idx >= 0 ? this.selector.substr(0, idx) : this.selector;
  }

  /**
   * Parse the "Host" header field to a hostname.
   *
   * Because Gopher protocol does not support request headers, this method will
   * always return `undefined`.
   *
   * @return {String}
   * @public
   */
  get hostname () {
    return undefined;
  }

  /**
   * Check if the request is fresh, aka Last-Modified and/or the ETag still
   * match.
   *
   * Due to limitations of Gopher protocol, this method will always return
   * false.
   *
   * @return {Boolean}
   * @public
   */
  get fresh () {
    return false;
  }

  /**
   * Check if the request is stale, aka "Last-Modified" and / or the "ETag" for
   * the resource has changed.
   *
   * @return {Boolean}
   * @public
   */
  get stale () {
    return !this.fresh;
  }

  /**
   * Check if the request was an _XMLHttpRequest_.
   *
   * Due to limitations of Gopher protocol, this method will always return
   * false.
   */
  get xhr () {
    return false;
  }

  /**
   * Return request header.
   *
   * Since Gopher protocol does not have request headers, this method will
   * always return `undefined`.
   *
   * Aliased as `Request#header()`.
   *
   * @param {String} name
   * @return {undefined}
   * @public
   */
  get () {
    return undefined;
  }

  header () {
    return this.get();
  }

  /**
   * Check if the given `type(s)` is acceptable, returning the best match when
   * true, otherwise `undefined`, in which case you should respond with 406
   * "Not Acceptable".
   *
   * Due to limitations of Gopher protocol, this method will always return
   * `undefined`.
   *
   * @param {String|Array} type(s)
   * @return {String|Array|Boolean}
   * @public
   */
  accepts () {
    return undefined;
  }

  /**
   * Check if the given `encoding`s are accepted.
   *
   * Due to limitations of Gopher protocol, this method will always return
   * `false`.
   *
   * @param {String} ...encoding
   * @return {String|Array}
   * @public
   */
  acceptsEncodings () {
    return false;
  }

  /**
   * Check if the given `charset`s are acceptable, otherwise you should
   * respond with 406 "Not Acceptable".
   *
   * Due to limitations of Gopher protocol, this method will always return
   * `false`.
   *
   * @param {String} ...charset
   * @return {String|Array}
   * @public
   */
  acceptsCharsets () {
    return false;
  }

  /**
   * Check if the given `lang`s are acceptable, otherwise you should respond
   * with 406 "Not Acceptable".
   *
   * Due to limitations of Gopher protocol, this method will always return
   * `false`.
   *
   * @param {String} ...lang
   * @return {String|Array}
   * @public
   */
  acceptsLanguages () {
    return false;
  }

  /**
   * Parse Range header field, capping to the given `size`.
   *
   * Because Gopher protocol doesn't support this feature, this method will
   * always return `undefined`.
   *
   * @param {number} size
   * @param {object} [options]
   * @param {boolean} [options.combine=false]
   * @return {number|array}
   * @public
   */
  range () {
    return undefined;
  }

  /**
   * Check if the incoming request contains the "Content-Type" header field,
   * and it contains the given mime `type`.
   *
   * Due to limitations of Gopher protocol, this method will always return
   * `false`.
   *
   * @param {String|Array} types...
   * @return {String|false|null}
   * @public
   */
  is () {
    return false;
  }
}

module.exports = Request;
