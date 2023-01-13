import { assign, filter, isEmpty, isString, startsWith } from 'lodash-es';

import { NotImplemented } from 'app/sankey/utils/error';

import { isNotEmpty } from '../utils';

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

  static construct(...urlLikes: Array<URLLike>) {
    assign(this, ...urlLikes.map(urlLike =>
      isString(urlLike) ? AppURL.matcher.exec(urlLike)?.groups ?? {} : urlLike,
    ));
  }

  constructor(...urlLikes: Array<URLLike>) {
    AppURL.construct.call(this, ...urlLikes);
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
    return url instanceof this ? url : new AppURL(url);
  }

  toString() {
    return this.scheme ? `${this.scheme}:${this.schemepart}` : this.schemepart;
  }

  toJSON(): string {
    return this.toString();
  }
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

export class HttpURL implements AppURL, URL {
  set schemepart(schemepart: string) {
    this.href = schemepart;
  }

  get schemepart(): string {
    return this.href;
  }

  get searchParamsObject() {
    return Object.freeze(Object.fromEntries(this.searchParams?.entries()));
  }

  get isRelative(): boolean {
    return isEmpty(this.hostname);
  }

  set pathname(value: string) {
    this.pathSegments = filter(value.split('/'), isNotEmpty);
  }

  get pathname(): string {
    return this.pathSegments?.map(segment => `/${segment}`).join('') ?? '';
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
    AppURL.construct.call(this, ...urlLikes);
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
    AppURL.construct.call(this, ...urlLikes);
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
    AppURL.construct.call(this, ...urlLikes);
  }

  toString() {
    return this.scheme ? `${this.scheme}:${this.schemepart}` : this.schemepart;
  }

  toJSON(): string {
    return this.toString();
  }
}
