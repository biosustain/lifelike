import { Injectable } from '@angular/core';

import { chunk } from 'lodash-es';

import { AppURL, HttpURL } from 'app/shared/url';

import {
  DataTransferData,
  DataTransferDataProvider,
  DataTransferToken,
} from '../../services/data-transfer-data.service';
import { isInternalUri } from '../../url/internal';

export const LABEL_TOKEN = new DataTransferToken<string>('label');
export const URI_TOKEN = new DataTransferToken<URIData[]>('uri-list');
export const LIFELIKE_URI_TOKEN = new DataTransferToken<URIData[]>('***ARANGO_DB_NAME***-uri-list');

export class URIData {
  title: string | undefined;
  uri: AppURL;
}

@Injectable()
export class GenericDataProvider implements DataTransferDataProvider<URIData[] | string> {
  static readonly acceptedUriPattern = /^[A-Za-z0-9-]{1,40}:/;

  static getURIs(data: URIData[] = []) {
    return {
      'text/uri-list': this.marshalUriList(data),
      'text/x-moz-url': this.marshalMozUrlList(data),
    };
  }

  static setURIs(
    dataTransfer: DataTransfer,
    data: URIData[],
    options: {
      action?: 'replace' | 'append';
    } = {}
  ) {
    if (data.length) {
      if (options.action === 'replace' || !dataTransfer.getData('text/uri-list')) {
        dataTransfer.setData('text/uri-list', this.marshalUriList(data));
      }

      // We can't always read the data transfer data
      if (
        !dataTransfer.types.includes('text/x-moz-url') ||
        dataTransfer.getData('text/x-moz-url')
      ) {
        const existing: URIData[] =
          options.action === 'replace'
            ? []
            : GenericDataProvider.unmarshalMozUrlList(
                dataTransfer.getData('text/x-moz-url'),
                'Link'
              );
        existing.push(...data);
        dataTransfer.setData('text/x-moz-url', GenericDataProvider.marshalMozUrlList(existing));
      }
    }
  }

  private static marshalMozUrlList(data: URIData[]): string {
    return data.map((item) => `${item.uri}\r\n${item.title.replace(/[\r\n]/g, '')}`).join('\r\n');
  }

  private static marshalUriList(data: URIData[]): string {
    return data.map((item) => item.uri).join('\r\n');
  }

  private static unmarshalMozUrlList(data: string, fallbackTitle: string): URIData[] {
    if (data === '') {
      return [];
    }

    const uris: URIData[] = [];

    for (const [uri, title] of chunk(data.split(/\r?\n/g), 2)) {
      if (uri.match(GenericDataProvider.acceptedUriPattern)) {
        uris.push({
          title: (title ?? fallbackTitle).trim().replace(/ {2,}/g, ' '),
          uri: new AppURL(uri),
        });
      }
    }

    return uris;
  }

  extractInternalUris(uris: URIData[]) {
    return uris
      .filter(({ uri }) => isInternalUri(uri))
      .map(({ uri, ...rest }) => ({
        ...rest,
        uri: new HttpURL((uri as HttpURL).relativehref),
      }));
  }

  extract(dataTransfer: DataTransfer): DataTransferData<URIData[] | string>[] {
    const results: DataTransferData<URIData[] | string>[] = [];
    let text = '';

    if (dataTransfer.types.includes('text/plain')) {
      text = dataTransfer.getData('text/plain');
    } else if (dataTransfer.types.includes('text/html')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(dataTransfer.getData('text/html'), 'text/html');
      text = (doc.textContent || '').trim();
    }

    text = text.trim().replace(/ {2,}/g, ' ');

    if (dataTransfer.types.includes('text/x-moz-url')) {
      const data = dataTransfer.getData('text/x-moz-url');

      const uris = GenericDataProvider.unmarshalMozUrlList(data, text);

      results.push({
        token: URI_TOKEN,
        data: uris,
        confidence: 0,
      });

      const internalUris = this.extractInternalUris(uris);

      if (internalUris) {
        results.push({
          token: LIFELIKE_URI_TOKEN,
          data: internalUris,
          confidence: 1,
        });
      }
    } else if (dataTransfer.types.includes('text/uri-list')) {
      const uris = dataTransfer
        .getData('text/uri-list')
        .split(/\r?\n/g)
        .filter(
          (item) =>
            item.trim().length &&
            !item.startsWith('#') &&
            item.match(GenericDataProvider.acceptedUriPattern)
        )
        .map((uri) => ({
          title: text,
          uri: new AppURL(uri),
        }));

      results.push({
        token: URI_TOKEN,
        data: uris,
        confidence: 0,
      });

      const internalUris = this.extractInternalUris(uris);

      if (internalUris) {
        results.push({
          token: LIFELIKE_URI_TOKEN,
          data: internalUris,
          confidence: 1,
        });
      }
    }

    results.push({
      token: LABEL_TOKEN,
      data: text,
      confidence: 0,
    });

    return results;
  }
}
