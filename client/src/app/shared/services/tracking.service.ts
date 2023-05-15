import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { catchError } from 'rxjs/operators';

import { TrackingEvent } from '../schemas/tracking';

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class TrackingService {
  readonly baseUrl = '/api/tracking';

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
  ) {
  }

  get currentURL() {
    // Stringified ActivatedRoute is object definition, not the actual URL
    // return this.route.toString()
    return this.router.serializeUrl(
      this.router.createUrlTree(['.'], {relativeTo: this.route}),
    );
  }

  register({url, ...rest}: Partial<TrackingEvent>) {
    return this.http.post(
      `${this.baseUrl}/`,
      {
        url: url ?? this.currentURL,
        ...rest,
      },
    ).pipe(
      catchError(err => {
          this.snackBar.open(
            `Failed to register event: ${err.message}`,
            'Dismiss',
            {duration: 2000},
          );
          throw err;
        },
      ),
    ).toPromise();
  }
}
