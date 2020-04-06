import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpRequest, HttpHandler } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import { HttpInterceptor} from '@angular/common/http';
import { AppUser } from 'app/interfaces';


@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class AuthenticationService implements HttpInterceptor {
  base_url = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private route: Router
  ) { }

  /**
   * Intercept every request's response where
   * jwt is expired, and renew access token
   * @param req 
   * @param next 
   */
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next.handle(req)
      .pipe(
        catchError(
          (err) => {

            if (err['status'] === 401 && !err['url'].includes('refresh')) {
              return this.refresh().pipe(
                switchMap(() => {
                  req = this.updateAuthHeader(req);
                  return next.handle(req);
                })
              )
            }

            return Observable.throw(err);
          }
        )
      );
  }

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param with_jwt
   */
  createHttpOptions(with_jwt=false) {
    const headers = {
      'Content-Type':  'application/json'
    }

    if (with_jwt) {
      headers['Authorization'] = 'Bearer ' + localStorage.getItem('access_jwt');
    }

    const httpOptions = {
      headers: new HttpHeaders(headers)
    };
    return httpOptions
  }

  /**
   * Allow auth header to be updated with new access jwt
   * @param request - request with auth ehader your trying to modify
   */
  updateAuthHeader(request: HttpRequest<any>) {
    return request.clone({
      setHeaders: {
        'Authorization': 'Bearer ' + localStorage.getItem('access_jwt')
      }
    })
  }

  /**
   * Renew user access token with their refresh token
   */
  public refresh(): Observable<any> {
    let jwt = localStorage.getItem('refresh_jwt');

  	return this.http.post(
    	this.base_url + '/auth/refresh',
      {jwt},
      this.createHttpOptions()
    ).pipe(
      tap(resp => {
        localStorage.setItem('access_jwt', resp['access_jwt']);
        localStorage.setItem('refresh_jwt', resp['refresh_jwt']);
      })
    );
  }


  /**
   * Authenticate users to get a JWT
   */
  public login(email: string, password: string) {
    return this.http.post<{user: AppUser, access_jwt: string, refresh_jwt: string}>(
      this.base_url + '/auth/login',
      {email_addr: email, password},
      this.createHttpOptions(),
    ).pipe(
      map((resp) => {
        localStorage.setItem('access_jwt', resp['access_jwt']);
        localStorage.setItem('refresh_jwt', resp['refresh_jwt']);
        return resp;
      })
    );
  }

  /**
   * Logout user and return to logout page ..
   * whle removing refresh and access jwt
   */
  public logout() {
    localStorage.removeItem('refresh_jwt');
    localStorage.removeItem('access_jwt');
    // See ***ARANGO_USERNAME***-store module where this is set
    localStorage.removeItem('auth');
  }
}
