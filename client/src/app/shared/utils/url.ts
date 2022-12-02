import { assign, filter, isEmpty, isMatch, startsWith, isArray } from 'lodash-es';

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
  search: string[][] | Record<string, string> | string | URLSearchParams;
  hash: string;
  host: string;
  origin: string;
  relativehref: string;
  href: string;
}

/**
 * Working with JS URL class is nice however it's requirement for url to be absolute is sometimes hard to go around.
 * This class implements same interface but deals well with relative URLs and provides convininet property setters.
 *
 * For more documentation check: https://url.spec.whatwg.org/#url-class
 */
export class AppURL implements URL, AppURLInterface {

  get searchParamsObject() {
    return Object.fromEntries(this.searchParams.entries());
  }

  get isRelative() {
    return isEmpty(this.hostname);
  }

  set pathname(value) {
    this.pathSegments = filter(value.split('/'), isNotEmpty);
  }

  get pathname() {
    return this.pathSegments.map(segment => `/${segment}`).join('');
  }

  set search(value: string) {
    this.searchParams = new URLSearchParams(value);
  }

  get search(): string {
    const search = this.searchParams.toString();
    return search ? `?${search}` : '';
  }

  set hash(value: string) {
    this.fragment = startsWith(value, '#') ? value.slice(1) : undefined;
  }

  get hash() {
    return this.fragment ? `#${this.fragment}` : '';
  }

  get host() {
    return (this.hostname ?? '') + (this.port ? `:${this.port}` : '');
  }

  set host(value) {
    Object.assign(this, value.match(URL_REGEX.host).groups);
  }

  get origin() {
    return (this.protocol ? `${this.protocol}//` : '') + this.host;
  }

  set origin(value) {
    Object.assign(this, value.match(URL_REGEX.origin).groups);
  }

  get href() {
    return this.origin + this.pathname + this.search + this.hash;
  }

  set href(value) {
    Object.assign(this, value.match(URL_REGEX.href).groups);
  }

  get relativehref() {
    return this.pathname + this.search + this.hash;
  }

  set relativehref(value) {
    Object.assign(this, value.match(URL_REGEX.relativehref).groups);
  }

  constructor(urlString: string = '', overwrites: Partial<AppURLInterface> = {}) {
    this.href = urlString;
    assign(this, overwrites);
  }
  fragment: string;
  hostname: string;
  port: string;
  protocol: string;
  username: string;
  password: string;
  searchParams: URLSearchParams;

  pathSegments: string[];

  static from(url: string|URL|AppURL) {
    return url instanceof this ? url : new AppURL(String(url));
  }

  /**
   * Typescript does not allow different type for setter&getter
   * As workaround providing custom setter to be used with other types
   */
  setSearch(value: string[][] | Record<string, string> | string | URLSearchParams) {
    this.searchParams = new URLSearchParams(value);
  }

  toAbsolute() {
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

export const lifelikeUrl = Object.freeze(new AppURL().toAbsolute());
export const isInternalUri = (uri: AppURL) => uri.isRelative || uri.origin === lifelikeUrl.origin;

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
  [{pathSegments: ['folders'], fragment: 'project'}, InternalURIType.Project],
  [['folders'], InternalURIType.Directory],
  [{pathSegments: {...['projects', , 'folders']}, fragment: 'project'}, InternalURIType.Project],
  [['projects', , 'folders'], InternalURIType.Directory],
  [['projects', , 'bioc'], InternalURIType.BioC],
  [['projects', , 'enrichment-table'], InternalURIType.EnrichmentTable],
  [['projects', , 'maps'], InternalURIType.Map],
  [['projects', , 'sankey'], InternalURIType.Graph],
  [['projects', , 'sankey-many-to-many'], InternalURIType.Graph],
  [['projects', , 'files'], InternalURIType.Pdf]
]);

export const getInternalURIType = (uri: AppURL) => {
  if (isInternalUri(uri)) {
    return findEntriesValue(
      internalURITypeMapping,
        // Current version of lodash has problem with sparse arrays (https://github.com/lodash/lodash/issues/5554)
        expected =>
          isMatch(
            uri,
            isArray(expected) ?
              { pathSegments: expected } :
              expected
          )
    );
  }
};
