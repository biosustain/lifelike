import { from, Observable, OperatorFunction, Subject } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

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

export function mapBufferToJsons<T>(encoding = 'utf-8'): OperatorFunction<ArrayBuffer, T | undefined> {
  return map((data: ArrayBuffer | undefined) => {
    if (data == null) {
      return null;
    }
    const text = new TextDecoder(encoding).decode(data);
    // @ts-ignore
    return text.split('\n').map(JSON.parse);
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
