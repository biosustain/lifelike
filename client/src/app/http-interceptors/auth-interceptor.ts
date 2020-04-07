import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { environment } from 'environments/environment';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { catchError, switchMap } from 'rxjs/operators';

/**
 * AuthenticationInterceptor is used to intercept all requests
 * and add a JWT token if it exists into the request. It will
 * attempt to refresh the token if it expires.
 */
@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {
    baseUrl = environment.apiUrl;

    constructor(private auth: AuthenticationService) {}

    intercept(req: HttpRequest<any>, next: HttpHandler) {
        return next.handle(req).pipe(
            catchError((res: HttpErrorResponse) => {
                if (res.status === 401 && !res.url.includes('refresh')) {
                    return this.auth.refresh().pipe(
                        switchMap(() => {
                            return next.handle(this.updateAuthHeader(req));
                        })
                    );
                }
                return next.handle(req);
            }),
        );
    }

    /**
     * Allow auth header to be updated with new access jwt
     * @param request - request with auth ehader your trying to modify
     */
    updateAuthHeader(request: HttpRequest<any>) {
        return request.clone({
        setHeaders: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem('access_jwt'),
        },
        });
    }
}
