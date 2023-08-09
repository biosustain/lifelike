import { Injectable, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

import { catchError } from 'rxjs/operators';

import { TrackingEvent } from '../schemas/tracking';

@Injectable({ providedIn: 'root' })
export class TrackingService {
  readonly baseUrl = '/api/tracking';

  constructor(private readonly http: HttpClient, private readonly snackBar: MatSnackBar) {}

  register(event: Partial<TrackingEvent>) {
    return this.http
      .post(`${this.baseUrl}/`, event)
      .pipe(
        catchError((err) => {
          if (isDevMode()) {
            this.snackBar.open(`Failed to register event: ${err.message}`, 'Dismiss', {
              duration: 2000,
            });
          }
          throw err;
        })
      )
      .toPromise();
  }
}
