import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { AppUser } from 'app/interfaces';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  readonly baseUrl = '/api/auth';

  constructor(private http: HttpClient) { }

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param withJwt boolean representing whether to return the options with a jwt
   */
  createHttpOptions(withJwt = false) {
    if (withJwt) {
      return {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('access_jwt'),
        }),
      };
    } else {
      return {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
      };
    }
  }

  /**
   * Authenticate users to get a JWT
   */
  public login(email: string, password: string) {
    return this.http.post<{user: AppUser, access_jwt: string, refresh_jwt: string}>(
      this.baseUrl + '/login',
      {email, password},
      this.createHttpOptions(),
    ).pipe(
      map((resp) => {
        localStorage.setItem('access_jwt', resp.access_jwt);
        localStorage.setItem('refresh_jwt', resp.refresh_jwt);
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
    // See root-store module where this is set
    localStorage.removeItem('auth');
  }

  /**
   * Renew user access token with their refresh token
   */
  public refresh() {
    const jwt = localStorage.getItem('refresh_jwt');

    return this.http.post<{access_jwt: string, refresh_jwt: string}>(
      this.baseUrl + '/refresh',
      { jwt },
      this.createHttpOptions()
    ).pipe(
        map((resp) => {
          localStorage.setItem('access_jwt', resp.access_jwt);
          localStorage.setItem('refresh_jwt', resp.refresh_jwt);
          return resp;
        })
      );
  }

  public getAccessToken() {
    return localStorage.getItem('access_jwt') || '';
  }
}
