import { from, Observable, OperatorFunction, Subject } from 'rxjs';
import { map, mergeMap, switchMap } from 'rxjs/operators';
import { partialRight, ary } from 'lodash-es';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { KnowledgeMapGraph } from 'app/drawing-tool/services/interfaces';
import { extractDescriptionFromSankey } from 'app/sankey/utils';

import { FORMATS_WITH_POSSIBLE_DESCRIPTION } from '../constants';

const utf8Decoder = new TextDecoder('utf-8');

export const bufferToJson = <T>(data: ArrayBuffer | undefined, textDecoder = utf8Decoder) =>
  data ? (JSON.parse(textDecoder.decode(data)) as T) : undefined;

export const bufferToJsons = <T>(data: ArrayBuffer | undefined, textDecoder = utf8Decoder) =>
  data
    ? textDecoder
        .decode(data)
        .split('\n')
        .filter((jl) => jl)
        .map((jsonline) => JSON.parse(jsonline) as T)
    : undefined;

export const mapBlobToBuffer = (): OperatorFunction<Blob, ArrayBuffer> =>
  switchMap((blob) => blob.arrayBuffer());

export const mapBufferToJson = <T>(
  textDecoder?: TextDecoder
): OperatorFunction<ArrayBuffer, T | undefined> =>
  map(ary(textDecoder ? partialRight(bufferToJson, textDecoder) : bufferToJson));

/**
 * Maps the graph stored in export to the graph suitable for further manipulation.
 * As nodes are stored groups, we add them to the 'nodes' collection - so we would have them all in one place.
 */
export function mapJsonToGraph(): OperatorFunction<KnowledgeMapGraph, KnowledgeMapGraph> {
  return map((graph) => {
    // TODO: This allows to handle the transition without data migration. Not sure if we want to do that though - maybe migration is better?
    graph.groups = graph.groups ?? [];
    graph.groups.forEach((group) => {
      graph.nodes = graph.nodes.concat(group.members);
    });
    return graph;
  });
}

export const mapBufferToJsons = <T>(
  textDecoder?: TextDecoder
): OperatorFunction<ArrayBuffer, T[]> =>
  map(ary(textDecoder ? partialRight(bufferToJsons, textDecoder) : bufferToJsons));

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
  link.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    })
  );

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
    return file.text().then((text) => {
      if (format === 'graph') {
        return extractDescriptionFromSankey(text);
      }
      return '';
    });
  }
  return Promise.resolve('');
}
