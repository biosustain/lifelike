import { from, Observable, of, OperatorFunction, Subject } from 'rxjs';
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

export function readBlobAsBuffer(blob: Blob): Observable<ArrayBuffer> {
  return from([blob]).pipe(
    mapBlobToBuffer(),
  );
}
