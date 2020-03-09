import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpRequest, HttpHandler } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { HttpInterceptor} from '@angular/common/http';


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
      headers['Authorization'] = 'Token ' + localStorage.getItem('access_jwt');
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
        'Authorization': 'Token ' + localStorage.getItem('access_jwt')
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
   * @param credential_form 
   */
  public login(credential_form): Observable<Object> {
    return this.http.post(
      this.base_url + '/auth/login',
      credential_form,
      this.createHttpOptions()
    ).pipe(
      tap(resp => {
        localStorage.setItem('access_jwt', resp['access_jwt']);
        localStorage.setItem('refresh_jwt', resp['refresh_jwt']);
      })
    )
  }

  /**
   * Logout user and return to logout page ..
   * whle removing refresh and access jwt
   */
  public logout() {
    localStorage.removeItem('refresh_jwt');
    localStorage.removeItem('access_jwt');
    this.route.navigateByUrl('/login');
  }
}
