import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { ErrorLog } from '../schemas/common';

const debounceDueTime = 1000;

@Injectable({ providedIn: '***ARANGO_USERNAME***' })
export class LoggingService {
  readonly baseUrl = '/api/logging/';

  loggingSubject = new Subject<ErrorLog>();

  constructor(private readonly http: HttpClient) {
    this.loggingSubject
      .pipe(distinctUntilChanged(), debounceTime(debounceDueTime))
      .subscribe((error) => http.post(this.baseUrl, error).toPromise().catch(console.error));
  }

  sendLogs(error: ErrorLog) {
    this.loggingSubject.next(error);
    return this.loggingSubject.asObservable();
  }
}
