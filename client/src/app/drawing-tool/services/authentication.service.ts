import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpRequest, HttpHandler } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { HttpInterceptor} from '@angular/common/http';


@Injectable({
  providedIn: 'root'
})
export class AuthenticationService implements HttpInterceptor {
  base_url = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private route: Router
  ) { }

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
    let jwt = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE1ODIzMjA5NTcsInN1YiI6InVzZXJAZ21haWwuY29tIiwiZXhwIjoxNTgyNDA3MzU3LCJ0eXBlIjoicmVmcmVzaCJ9.NwHyqsIlJssRIt2Oo5VRCIo6XKiJLbMnnAZy4lR0h7o'

  	return this.http.post(
    	this.base_url + '/refresh',
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
      this.base_url + '/login',
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
   */
  public logout() {
    localStorage.removeItem('refresh_jwt');
    localStorage.removeItem('access_jwt');
    this.route.navigateByUrl('/login');
  }
}
