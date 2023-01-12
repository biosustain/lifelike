import { assign, filter, isEmpty, isMatch, startsWith, isArray, isString, isObjectLike } from 'lodash-es';

import { NotImplemented } from 'app/sankey/utils/error';

import { findEntriesKey, findEntriesValue, isNotEmpty } from '../utils';
import { InternalURIType, Unicodes } from '../constants';

// tslint:disable-next-line:class-name
class URL_REGEX {
  static protocol = '(?<protocol>\\w+\\:)';
  static username = '(?<username>[^:@\\/]*)';
  static password = '(?<password>[^:@\\/]*)';
  static hostname = '(?<hostname>[^\\:\\/]+)';
  static port = '(?<port>\\d+)';
  static pathname = '(?<pathname>[^\\?#]*)';
  static search = '(?<search>\\?[^#]*)';
  static hash = '(?<hash>#.*)';
  static host = `${URL_REGEX.hostname}(?:\\:${URL_REGEX.port})?`;
  static origin = `(?:${URL_REGEX.protocol}\\/\\/)?(?:${URL_REGEX.username}(?:\\:${URL_REGEX.password})?(?:@))?${URL_REGEX.host}`;
  static relativehref = `${URL_REGEX.pathname}${URL_REGEX.search}?${URL_REGEX.hash}?$`;
  static href = `^(?:${URL_REGEX.origin})?${URL_REGEX.pathname}${URL_REGEX.search}?${URL_REGEX.hash}?$`;
}

interface AppURLInterface {
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  pathname: string;
  pathSegments: string[];
  search: string[][] | Record<string, string> | string | URLSearchParams;
  hash: string;
  fragment: string|URLSearchParams;
  host: string;
  origin: string;
  relativehref: string;
  href: string;
}

type URLLike<T extends AppURL = AppURL> = string | Partial<T|AppURL>;

/**
 * Working with JS URL class is nice however it's requirement for url to be absolute is sometimes hard to go around.
 * This class implements same interface but deals well with relative URLs and provides convininet property setters.
 *
 * For more documentation check: https://url.spec.whatwg.org/#url-class and https://datatracker.ietf.org/doc/html/rfc1738
 */
export class AppURL {
  static readonly matcher: RegExp = /^(?<scheme>[a-z0-9+-\.]+):?(?<schemepart>.*)$/i;
  scheme: string;
  schemepart: string;

  constructor(...urlLikes: Array<URLLike>) {
    assign(this, ...urlLikes.map(urlLike =>
      isString(urlLike) ? AppURL.matcher.exec(urlLike).groups : urlLike,
    ));
    const scheme = this.scheme ?? window.location.protocol;
    switch (scheme) {
      case 'mailto':
        return new MailtoURL(this);
      case 'ftp':
        return new FtpURL(this);
      case 'http':
      case 'https':
        return new HttpURL(this);
      default:
        throw new NotImplemented(`Urls with scheme "${scheme}" are not supported within application.`);
    }
  }

  static from(url: URLLike): AppURL {
    return url instanceof this ? url : new AppURL(String(url));
  }

  toString() {
    return this.scheme ? `${this.scheme}:${this.schemepart}` : this.schemepart;
  }

  toJSON(): string {
    return this.toString();
  }

  update(overwrites: Partial<this>): this {
    assign(this, overwrites);
    return this;
  }
}

export class HttpURL implements AppURL, URL, AppURLInterface {

  set schemepart(schemepart: string) {
    this.href = schemepart;
  }

  get schemepart() {
    return this.href;
  }

  get searchParamsObject() {
    return Object.freeze(Object.fromEntries(this.searchParams.entries()));
  }

  get isRelative(): boolean {
    return isEmpty(this.hostname);
  }

  set pathname(value: string) {
    this.pathSegments = filter(value.split('/'), isNotEmpty);
  }

  get pathname(): string {
    return this.pathSegments.map((segment) => `/${segment}`).join('');
  }

  set search(value: any) {
    this.searchParams = new URLSearchParams(value);
  }

  get search(): any {
    const search = this.searchParams.toString();
    return search ? `?${search}` : '';
  }

  set hash(value: string) {
    this.fragment = startsWith(value, '#') ? value.slice(1) : undefined;
  }

  get hash(): string {
    return this.fragment ? `#${this.fragment}` : '';
  }

  get host(): string {
    return (this.hostname ?? '') + (this.port ? `:${this.port}` : '');
  }

  set host(value: string) {
    Object.assign(this, value.match(URL_REGEX.host).groups);
  }

  get origin(): string {
    return (this.protocol ? `${this.protocol}//` : '') + this.host;
  }

  set origin(value: string) {
    Object.assign(this, value.match(URL_REGEX.origin).groups);
  }

  get href(): string {
    return this.origin + this.pathname + this.search + this.hash;
  }

  set href(value: string) {
    Object.assign(this, value.match(URL_REGEX.href).groups);
  }

  get relativehref(): string {
    return this.pathname + this.search + this.hash;
  }

  set relativehref(value: string) {
    Object.assign(this, value.match(URL_REGEX.relativehref).groups);
  }

  constructor(...urlLikes: Array<URLLike<HttpURL>>) {
    assign(this, ...urlLikes.map(urlLike =>
      isString(urlLike) ? AppURL.matcher.exec(urlLike).groups : urlLike,
    ));
  }
  static readonly matcher: RegExp = new RegExp(URL_REGEX.href);
  scheme: string;

  fragment: string|URLSearchParams;
  hostname: string;
  port: string;
  protocol: string;
  username: string;
  password: string;
  searchParams: URLSearchParams;

  pathSegments: string[];

  static from(url: URLLike<HttpURL>) {
    return url instanceof this ? url : new HttpURL(String(url));
  }

  get domain() {
    return this.hostname.replace(/^www\./i, '');
  }

  /**
   * Typescript does not allow different type for setter&getter
   * As workaround providing custom setter to be used with other types
   */
  setSearch(value: string[][] | Record<string, string> | string | URLSearchParams) {
    this.searchParams = new URLSearchParams(value);
  }

  update(overwrites: Partial<this>): this {
    assign(this, overwrites);
    return this;
  }

  toAbsolute(): HttpURL {
    this.origin = window.location.href;
    return this;
  }

  toString(): string {
    return this.href;
  }

  toJSON(): string {
    return this.toString();
  }
}

class FtpURL implements AppURL {
  static readonly matcher: RegExp = /^(?<scheme>[a-z0-9+-\.]+):?(?<schemepart>.*)$/i;
  scheme: string;
  schemepart: string;

  constructor(...urlLikes: Array<URLLike<FtpURL>>) {
    assign(this, ...urlLikes.map(urlLike =>
      isString(urlLike) ? AppURL.matcher.exec(urlLike).groups : urlLike,
    ));
  }

  static from(url: URLLike<FtpURL>): FtpURL {
    return url instanceof this ? url : new FtpURL(String(url));
  }

  toString() {
    return this.scheme ? `${this.scheme}:${this.schemepart}` : this.schemepart;
  }

  toJSON(): string {
    return this.toString();
  }

  update(overwrites: Partial<this>): this {
    assign(this, overwrites);
    return this;
  }
}

class MailtoURL implements AppURL {
  static readonly matcher: RegExp = /^(?<email>.*)$/i;
  scheme: string;
  email: string;
  set schemepart(schemepart: string) {
    assign(this, MailtoURL.matcher.exec(schemepart).groups);
  }

  get schemepart() {
    return `${this.email}`;
  }

  constructor(...urlLikes: Array<URLLike<MailtoURL>>) {
    assign(this, ...urlLikes.map(urlLike =>
      isString(urlLike) ? AppURL.matcher.exec(urlLike).groups : urlLike,
    ));
  }

  toString() {
    return this.scheme ? `${this.scheme}:${this.schemepart}` : this.schemepart;
  }

  toJSON(): string {
    return this.toString();
  }

  update(overwrites: Partial<this>): this {
    assign(this, overwrites);
    return this;
  }
}

export const ***ARANGO_DB_NAME***Url = Object.freeze(new HttpURL().toAbsolute());
export const isInternalUri = (uri: AppURL): uri is HttpURL =>
  (uri as HttpURL).isRelative || (uri as HttpURL).origin === ***ARANGO_DB_NAME***Url.origin;

/**This is mapping between indexed path segments and uri types
 * Examples:
 * - to identify "http://host.abc/projects/:project_name/enrichment-table/:file_id" as enrichment table
 *   it's sufficient to say that first path segment equals 'projects' and 3rd one 'enrichment-table'.
 *   This can be expressed at least in two ways:
 *    + ['projects', ,'enrichment-table'] - ussing sparse array notation
 *    + {0: 'projects', 3: 'enrichment-table'} - ussing object
 */
const internalURITypeMapping: Map<object, InternalURIType> = new Map([
  [['search', 'content'], InternalURIType.Search],
  [['search', 'graph'], InternalURIType.KgSearch],
  [{ pathSegments: ['folders'], fragment: 'project' }, InternalURIType.Project],
  [['folders'], InternalURIType.Directory],
  [
    { pathSegments: { ...['projects', , 'folders'] }, fragment: 'project' },
    InternalURIType.Project,
  ],
  [['projects', , 'folders'], InternalURIType.Directory],
  [['projects', , 'bioc'], InternalURIType.BioC],
  [['projects', , 'enrichment-table'], InternalURIType.EnrichmentTable],
  [['projects', , 'maps'], InternalURIType.Map],
  [['projects', , 'sankey'], InternalURIType.Graph],
  [['projects', , 'sankey-many-to-many'], InternalURIType.Graph],
  [['projects', , 'files'], InternalURIType.Pdf],
]);

export const getInternalURIType = (uri: AppURL) => {
  if (isInternalUri(uri)) {
    return findEntriesValue(
      internalURITypeMapping,
      // Current version of lodash has problem with sparse arrays (https://github.com/lodash/lodash/issues/5554)
      (expected) => isMatch(uri, isArray(expected) ? { pathSegments: expected } : expected)
    );
  }
};
