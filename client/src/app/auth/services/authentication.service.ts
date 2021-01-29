import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { AppUser } from 'app/interfaces';
import { isNullOrUndefined } from 'util';

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class AuthenticationService {
  readonly baseUrl = '/api/auth';

  constructor(private http: HttpClient) { }

  getAuthHeader(): string | void {
    const token = localStorage.getItem('access_jwt');
    if (token) {
      return `Bearer ${token}`;
    }
  }

  /**
   * Authenticate users to get a JWT
   */
  public login(email: string, password: string) {
    return this.http.post<{user: AppUser, access_jwt: string, refresh_jwt: string}>(
      this.baseUrl + '/login',
      {email, password},
    ).pipe(
      map((resp: any) => {
        localStorage.setItem('auth', resp.user);
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
    // See ***ARANGO_USERNAME***-store module where this is set
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
    ).pipe(
        map((resp: {access_jwt: string, refresh_jwt: string}) => {
          localStorage.setItem('access_jwt', resp.access_jwt);
          localStorage.setItem('refresh_jwt', resp.refresh_jwt);
          return resp;
        }),
      );
  }

  public whoAmI(): number {
    const auth = JSON.parse(localStorage.getItem('auth'));

    if (
      isNullOrUndefined(auth)
    ) { return; }

    return auth.user.id;
  }

  public getAccessToken() {
    return localStorage.getItem('access_jwt') || '';
  }

  /**
   * Write cookie to system
   * @param name - represent id name of cookie
   * @param value - value for cookie to store
   * @param days - how long should cookie exist
   */
  setCookie(name, value, days= 30) {
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + (value || '')  + expires + '; path=/';
  }
  getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') { c = c.substring(1, c.length); }
        if (c.indexOf(nameEQ) === 0) { return c.substring(nameEQ.length, c.length); }
    }
    return null;
  }
  eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;';
  }
}
