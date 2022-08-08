import { from, Observable, OperatorFunction, Subject } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import JSZip from 'jszip';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { KnowledgeMapGraph } from 'app/drawing-tool/services/interfaces';
import { extractDescriptionFromSankey } from 'app/sankey/utils';

import { FORMATS_WITH_POSSIBLE_DESCRIPTION } from '../constants';

export function mapBlobToJson<T>(): OperatorFunction<Blob, Promise<T>> {
  return map(async blob => {
      const graphRepr =  await JSZip.loadAsync(blob).then((zip: JSZip) => {
        return zip.files['graph.json'].async('text').then((text: string) => {
          return text;
        });
      });
      return JSON.parse(graphRepr) as T;
  });
}

export function mapBlobToBuffer(): OperatorFunction<Blob, ArrayBuffer> {
  return mergeMap(blob => {
    const subject = new Subject<ArrayBuffer>();
    const reader = new FileReader();
    reader.onload = e => {
      subject.next((e.target as FileReader).result as ArrayBuffer);
    };
    reader.onerror = e => subject.error(e);
    reader.onabort = e => subject.error(e);
    reader.readAsArrayBuffer(blob);
    return subject;
  });
}

export function mapBufferToJson<T>(encoding = 'utf-8'): OperatorFunction<ArrayBuffer, T | undefined> {
  return map((data: ArrayBuffer | undefined) => {
    if (data == null) {
      return null;
    }
    return JSON.parse(new TextDecoder(encoding).decode(data)) as T;
  });
}

/**
 * Maps the graph stored in export to the graph suitable for further manipulation.
 * As nodes are stored groups, we add them to the 'nodes' collection - so we would have them all in one place.
 */
export function mapJsonToGraph(): OperatorFunction<KnowledgeMapGraph, KnowledgeMapGraph> {
  return map( graph => {
    // TODO: This allows to handle the transition without data migration. Not sure if we want to do that though - maybe migration is better?
    graph.groups = graph.groups ?? [];
    graph.groups.forEach(group => {
      graph.nodes = graph.nodes.concat(group.members);
    });
    return graph;
  });
}

export function mapBufferToJsons<T>(encoding = 'utf-8'): OperatorFunction<ArrayBuffer, any | undefined> {
  return map((data: ArrayBuffer | undefined) => {
    if (data == null) {
      return null;
    }
    const text = new TextDecoder(encoding).decode(data);
    const jsonLines = text.split('\n');
    return jsonLines.reduce((o, n) => {
      if (n) {
        o.push(JSON.parse(n));
      }
      return o;
    }, []);
  });
}

export function readBlobAsBuffer(blob: Blob): Observable<ArrayBuffer> {
  return from([blob]).pipe(
    mapBlobToBuffer(),
  );
}

export function openDownloadForBlob(blob: Blob, filename: string): void {
  // IE doesn't allow using a blob object directly as link href
  // instead it is necessary to use msSaveOrOpenBlob
  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveOrOpenBlob(blob);
    return;
  }

  // For other browsers:
  // Create a link pointing to the ObjectURL containing the blob.
  const data = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = data;
  link.download = filename;
  // this is necessary as link.click() does not work on the latest firefox
  link.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));

  setTimeout(() => {
    // For Firefox it is necessary to delay revoking the ObjectURL
    window.URL.revokeObjectURL(data);
    link.remove();
  }, 100);
}

export const getPath = (object: FilesystemObject | undefined): FilesystemObject[] => {
  let current = object;
  const path = [];
  while (current != null) {
    path.push(current);
    current = current.parent;
  }
  return path.reverse();
};

// TODO: Change this to extractAllLifelikeMetadata when we decide to download the metadata
export function extractDescriptionFromFile(file: File): Promise<string> {
  const format = file.name.split('.').pop();
  if (FORMATS_WITH_POSSIBLE_DESCRIPTION.includes(format)) {
    return file.text().then(text => {
      if (format === 'graph') {
        return extractDescriptionFromSankey(text);
      }
      return '';
   });
  }
  return Promise.resolve('');
}
