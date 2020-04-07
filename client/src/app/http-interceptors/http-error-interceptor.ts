import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse, HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';
import { Router } from '@angular/router';

import { environment } from '../../environments/environment';

/**
 * HttpErrorInterceptor is used to intercept a request/response
 * and parse the error to display the actual error message
 * on the UI, instead of a generic error message.
 */
@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
    baseUrl = environment.apiUrl;

    constructor(
        private http: HttpClient,
    ) {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
        return next.handle(req).pipe(
            catchError((res: HttpErrorResponse) => {
                if (res.status === 0) {
                    // TODO: client-side error
                    // e.g no network
                    return throwError('No internet connection');
                } else {
                    if (res.status >= 500) {
                        return throwError({
                            serverError: res.error.apiHttpError,
                            status: res.status,
                        });
                    } else {
                        if (res.status === 401 && !res.url.includes('refresh')) {
                            return this.refresh().pipe(
                                switchMap(() => {
                                  req = this.updateAuthHeader(req);
                                  return next.handle(req);
                                })
                            );
                        }
                    }

                }
            }),
        );
    }

    /**
     * Create http options with authorization
     * header if boolean set to true
     * @param withJwt boolean representing whether to use a jwt or not
     */
    createHttpOptions(withJwt = false) {
        if (withJwt) {
            return {
                headers: new HttpHeaders(
                    {
                        'Content-Type':  'application/json',
                        Authorization: 'Token ' + localStorage.getItem('access_jwt')
                    }
                )
            };
        } else {
            return {
                headers: new HttpHeaders(
                    {
                        'Content-Type':  'application/json',
                    }
                )
            };
        }
    }

    /**
     * Allow auth header to be updated with new access jwt
     * @param request - request with auth ehader your trying to modify
     */
    updateAuthHeader(request: HttpRequest<any>) {
        return request.clone({
            setHeaders: {
                Authorization: 'Bearer ' + localStorage.getItem('access_jwt')
            }
        });
    }

    /**
     * Renew user access token with their refresh token
     */
    public refresh(): Observable<any> {
        const jwt = localStorage.getItem('refresh_jwt');

        return this.http.post(
            this.baseUrl + '/auth/refresh',
            {jwt},
            this.createHttpOptions()
        ).pipe(
            tap(resp => {
                localStorage.setItem('access_jwt', resp.access_jwt);
                localStorage.setItem('refresh_jwt', resp.refresh_jwt);
            })
        );
    }
}
