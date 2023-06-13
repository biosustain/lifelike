import { AppURL, HttpURL, FtpURL, MailtoURL } from '.';
import objectContaining = jasmine.objectContaining;

const exampleHttpURLs = [
  'http://www.wikipedia.org/wiki/URL',
  'https://kit.fontawesome.com/5d9e8add78.js',
  'https://***ARANGO_DB_NAME***.bio/assets/img/graph_embed/hero.jpg',
  'https://***ARANGO_DB_NAME***.bio',
  'https://fonts.googleapis.com/css2?' +
    'family=Patua+One&' +
    'family=Playfair+Display&' +
    'display=swap',
  'https://www.googletagmanager.com/gtag/js?id=G-Q5G16C0YEL',
  '/projects/Dominik/files/02roQJNPFgG2NxUaFWJOgg',
  '/folders/02pMOLK8u95J1gbCGivb0C',
  '/projects/Dominik/maps/02rTJeZDlND7qHfnHKdaoz/edit',
  '/search/content?page=1&limit=20&sort=&types=&folders=&q=Symbiosis',
  '/search/graph?q=Back&page=1',
];

const exampleMailToURLs = [
  'mailto:test@***ARANGO_DB_NAME***.edu',
  'mailto:test@***ARANGO_DB_NAME***.edu?cc=test@***ARANGO_DB_NAME***.edu&bcc=test@***ARANGO_DB_NAME***.edu' +
    '&subject=The%20subject%20of%20the%20email' +
    '&body=The%20body%20of%20the%20email',
];

const exampleFtpURLs = ['ftp://user:password@host:80/path'];

const exampleURLs = [...exampleHttpURLs, ...exampleMailToURLs, ...exampleFtpURLs];

describe('url should be same after decoding and encoding again', () => {
  it('AppURL', () => exampleURLs.forEach((url) => expect(new AppURL(url).toString()).toBe(url)));
  it('HttpURL', () =>
    exampleHttpURLs.forEach((url) => expect(new HttpURL(url).toString()).toBe(url)));
  it('MailtoURL', () =>
    exampleMailToURLs.forEach((url) => expect(new MailtoURL(url).toString()).toBe(url)));
  it('FtpURL', () => exampleFtpURLs.forEach((url) => expect(new FtpURL(url).toString()).toBe(url)));
});

describe('AppURL should init right url class', () => {
  it('AppURL -> HttpURL', () =>
    exampleHttpURLs.forEach((url) => expect(new AppURL(url)).toBeInstanceOf(HttpURL)));
  it('AppURL -> MailtoURL', () =>
    exampleMailToURLs.forEach((url) => expect(new AppURL(url)).toBeInstanceOf(MailtoURL)));
  it('AppURL -> FtpURL', () =>
    exampleFtpURLs.forEach((url) => expect(new AppURL(url)).toBeInstanceOf(FtpURL)));
});

const urlClasses = [HttpURL, MailtoURL, FtpURL];

describe('From method should not re-init new class', () => {
  urlClasses.forEach((c) => {
    it(`${c.name}.from`, () => {
      const testInstance = new c();
      expect(c.from(testInstance) === testInstance).toBeTrue();
    });
  });
});

describe('HttpURL parses correctly', () => {
  it('distinguish search params', () => {
    const url = new HttpURL('/search/graph?q=Back&page=1');
    expect(url.pathSegments).toEqual(['search', 'graph']);
    expect(url.searchParams.toString()).toEqual('q=Back&page=1');
  });
});
