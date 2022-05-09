import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { TrackingEvent, TRACKING_CATEGORIES } from '../schemas/tracking';

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class TrackingService {
  readonly baseUrl = '/api/tracking';

  constructor(private readonly http: HttpClient) {}

  register(event: Partial<TrackingEvent>) {
    return this.http.post(
      `${this.baseUrl}/`,
      event
    ).toPromise();
  }
}
