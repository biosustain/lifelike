import { assign, startsWith, isEmpty, filter } from 'lodash-es';

import { isNotEmpty } from '../utils';

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
  href: string;
}

/**
 * Working with JS URL class is nice however it's requirement for url to be absolute is sometimes hard to go around.
 * This class implements same interface but deals well with relative URLs and provides convininet property setters.
 *
 * For more documentation check: https://url.spec.whatwg.org/#url-class
 */
export class AppURL implements URL, AppURLInterface {
  constructor(urlString: string, overwrites: Partial<AppURLInterface> = {}) {
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

  get searchParamsObject() {
    return Object.fromEntries(this.searchParams.entries());
  }

  pathSegments: string[];

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

  /**
   * Typescript does not allow different type for setter&getter
   * As workaround providing custom setter to be used with other types
   */
  setSearch(value: string[][] | Record<string, string> | string | URLSearchParams) {
    this.searchParams = new URLSearchParams(value);
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

  toString(): string {
    return this.href;
  }

  toJSON(): string {
    return this.toString();
  }
}
