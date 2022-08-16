import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { TrackingEvent } from '../schemas/tracking';

@Injectable({providedIn: 'root'})
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
