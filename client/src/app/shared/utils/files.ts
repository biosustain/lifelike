import { Observable, OperatorFunction, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

export function readBlobAsBuffer(blob: Blob): Observable<ArrayBuffer> {
  const subject = new Subject<ArrayBuffer>();
  const reader = new FileReader();
  reader.onload = e => {
    subject.next((e.target as FileReader).result as ArrayBuffer);
  };
  reader.onerror = e => subject.error(e);
  reader.onabort = e => subject.error(e);
  reader.readAsArrayBuffer(blob);
  return subject;
}

export function mapBufferToJson<T>(encoding = 'utf-8'): OperatorFunction<ArrayBuffer, T | undefined> {
  return map((data: ArrayBuffer | undefined) => {
    if (data == null) {
      return null;
    }
    return JSON.parse(new TextDecoder(encoding).decode(data)) as T;
  });
}
