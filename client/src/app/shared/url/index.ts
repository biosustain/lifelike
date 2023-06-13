import { assign, filter, isEmpty, isString, startsWith, chain, unary } from 'lodash-es';

import { NotImplemented } from 'app/sankey/utils/error';

import { isNotEmpty } from '../utils';

/**
 * Working with JS URL class is nice however it's requirement for url to be absolute is sometimes hard to go around.
 * This class implements same interface but deals well with relative URLs and provides convininet property setters.
 *
 * For more documentation check: https://url.spec.whatwg.org/#url-class and https://datatracker.ietf.org/doc/html/rfc1738
 */
export class AppURL {
  readonly matcher: RegExp = /^(?<scheme>[a-z0-9+-\.]+)?:/i;

  /**
   * Returns class instance which implements AppUrl interface.
   * Based of schema the actual class will differ, so it can constain schema specific accessors.
   */
  constructor(private url?: string) {
    const scheme = this.matcher.exec(url)?.groups?.scheme;
    switch (scheme) {
      case 'mailto':
        return new MailtoURL(url);
      case 'ftp':
        return new FtpURL(url);
      case 'http':
      case 'https':
      case undefined: // if no schema it is relative http url
        return new HttpURL(url);
      default:
        throw new NotImplemented(
          `Urls with scheme "${scheme}" are not supported within application.`
        );
    }
  }
}

interface AppURLBase {
  toJSON(): string;
  toString(): string;
  freeze(): Readonly<this>;
}

type URLLike<T extends AppURLBase> = string | Partial<T>;

/**
 * Shared among URL classes construct starting point.
 *
 * It is designed to handle every url-like entity from string to AppURL.
 * Passing multiple values allows creating URLs with overwrites.
 * Commonly new AppURL(appURLInstance, { overwrites }) creates URL copy with applied overwrites.
 */
function construct<T extends AppURLBase>(this: AppURL, ...urlLikes: Array<URLLike<T>>) {
  assign(
    this,
    ...urlLikes.map((urlLike) =>
      isString(urlLike) ? this.matcher.exec(urlLike)?.groups ?? {} : urlLike
    )
  );
}

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

export class HttpURL implements AppURLBase, URL {
  set schemepart(schemepart: string) {
    this.href = schemepart;
  }

  get schemepart(): string {
    return this.href;
  }

  set protocol(protocol) {
    // protocol is '{schema}:'
    this.scheme = protocol?.slice(0, -1);
  }

  get protocol() {
    return this.scheme ? this.scheme + ':' : undefined;
  }

  get searchParamsObject() {
    return Object.freeze(Object.fromEntries(this.searchParams?.entries() ?? []));
  }

  get isRelative(): boolean {
    return isEmpty(this.hostname);
  }

  set pathname(value: string) {
    this.pathSegments = chain(value)
      .split('/')
      .filter(isNotEmpty)
      .map(unary(decodeURIComponent))
      .value();
  }

  get pathname(): string {
    return (
      chain(this.pathSegments)
        .map((segment) => `/${encodeURIComponent(segment)}`)
        .join('')
        .value() ?? ''
    );
  }

  set search(value: any) {
    this.searchParams = new URLSearchParams(value);
  }

  get search(): any {
    const search = this.searchParams?.toString();
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
    assign(this, value.match(URL_REGEX.host).groups);
  }

  get origin(): string {
    return (this.protocol ? `${this.protocol}//` : '') + this.host;
  }

  set origin(value: string) {
    assign(this, value.match(URL_REGEX.origin).groups);
  }

  get href(): string {
    return this.origin + this.pathname + this.search + this.hash;
  }

  set href(value: string) {
    assign(this, value.match(URL_REGEX.href).groups);
  }

  get relativehref(): string {
    return this.pathname + this.search + this.hash;
  }

  set relativehref(value: string) {
    assign(this, value.match(URL_REGEX.relativehref).groups);
  }

  constructor(...urlLikes: Array<URLLike<HttpURL>>) {
    construct.call(this, ...urlLikes);
  }

  readonly matcher: RegExp = new RegExp(URL_REGEX.href);
  scheme: string;

  fragment: string | URLSearchParams;
  hostname: string;
  port: string;
  username: string;
  password: string;
  searchParams: URLSearchParams;

  pathSegments: Array<string | number | boolean>;

  static from(url: URLLike<HttpURL>) {
    return url instanceof this ? url : new HttpURL(url);
  }

  get domain() {
    return this.hostname?.replace(/^www\./i, '');
  }

  /**
   * Typescript does not allow different type for setter&getter
   * As workaround providing custom setter to be used with other types
   */
  setSearch(value: string[][] | Record<string, string> | string | URLSearchParams) {
    this.searchParams = new URLSearchParams(value);
  }

  toAbsolute(): HttpURL {
    return new HttpURL(this, { origin: window.location.href });
  }

  toString(): string {
    return this.href;
  }

  toJSON(): string {
    return this.toString();
  }

  freeze() {
    return Object.freeze(this);
  }
}

export class FtpURL implements AppURLBase {
  readonly matcher: RegExp = /^(?<scheme>[a-z0-9+-\.]+):?(?<schemepart>.*)$/i;
  scheme: string;
  schemepart: string;

  constructor(...urlLikes: Array<URLLike<FtpURL>>) {
    construct.call(this, ...urlLikes);
  }

  static from(url: URLLike<FtpURL>): FtpURL {
    return url instanceof this ? url : new FtpURL(url);
  }

  toString() {
    return this.scheme ? `${this.scheme}:${this.schemepart}` : this.schemepart;
  }

  toJSON(): string {
    return this.toString();
  }

  freeze() {
    return Object.freeze(this);
  }
}

export class MailtoURL implements AppURLBase {
  readonly matcher: RegExp = /^(?<scheme>[a-z0-9+-\.]+)?:?(?<email>.*)$/i;
  scheme: string;
  email: string;

  set schemepart(value: string) {
    this.email = value;
  }

  get schemepart() {
    return this.email;
  }

  constructor(...urlLikes: Array<URLLike<MailtoURL>>) {
    construct.call(this, ...urlLikes);
  }

  static from(url: URLLike<MailtoURL>): MailtoURL {
    return url instanceof this ? url : new MailtoURL(url);
  }

  toString() {
    return this.scheme ? `${this.scheme}:${this.schemepart}` : this.schemepart;
  }

  toJSON(): string {
    return this.toString();
  }

  freeze() {
    return Object.freeze(this);
  }
}
