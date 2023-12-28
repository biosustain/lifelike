import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, of, timer, Subscription } from 'rxjs';
import { map, mergeMap, shareReplay } from 'rxjs/operators';
import { select, Store } from '@ngrx/store';

import { LifelikeJWTTokenResponse } from 'app/interfaces';
import { State } from 'app/root-store';

import { AuthSelectors } from '../store';

@Injectable({ providedIn: 'root' })
export class AuthenticationService implements OnDestroy {
  constructor(private http: HttpClient, private readonly store: Store<State>) {}
  readonly baseUrl = '/api/auth';

  private refreshSubscription: Subscription;

  public loggedIn$ = this.store.pipe(
    select(AuthSelectors.selectAuthLoginState),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  public appUser$ = this.store.pipe(
    select(AuthSelectors.selectAuthUser),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  public userRoles$ = this.store.pipe(
    select(AuthSelectors.selectRoles),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  public isAdmin$ = this.userRoles$.pipe(
    map((roles) => roles.includes('admin')),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  ngOnDestroy() {
    this.refreshSubscription.unsubscribe();
  }

  getAuthHeader(): string | void {
    const token = localStorage.getItem('access_jwt');
    if (token) {
      return `Bearer ${token}`;
    }
  }

  public isAuthenticated(): boolean {
    const expirationTime = new Date(localStorage.getItem('expires_at')).getTime();
    const currentTime = new Date().getTime();
    return currentTime < expirationTime;
  }

  public scheduleRenewal() {
    if (!this.isAuthenticated()) {
      return;
    }
    const expirationTime = new Date(localStorage.getItem('expires_at')).getTime();
    const source = of(expirationTime).pipe(
      mergeMap((expiresAt) => {
        const now = new Date().getTime();
        return timer(Math.max(1, expiresAt - now)).pipe(mergeMap(() => this.refresh()));
      })
    );

    this.refreshSubscription = source.subscribe(() => {});
  }

  /**
   * Authenticate users to get a JWT
   */
  public login(email: string, password: string): Observable<LifelikeJWTTokenResponse> {
    return this.http
      .post<LifelikeJWTTokenResponse>(this.baseUrl + '/login', { email, password })
      .pipe(
        map((resp: LifelikeJWTTokenResponse) => {
          localStorage.setItem('access_jwt', resp.accessToken.token);
          localStorage.setItem('expires_at', resp.accessToken.exp);
          // TODO: Move this out of localStorage
          localStorage.setItem('refresh_jwt', resp.refreshToken.token);
          this.scheduleRenewal();
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
    localStorage.removeItem('expires_at');
  }

  /**
   * Renew user access token with their refresh token
   */
  public refresh() {
    const jwt = localStorage.getItem('refresh_jwt');
    return this.http.post<LifelikeJWTTokenResponse>(this.baseUrl + '/refresh', { jwt }).pipe(
      map((resp) => {
        localStorage.setItem('access_jwt', resp.accessToken.token);
        localStorage.setItem('expires_at', resp.accessToken.exp);
        // TODO: Remove refresh token from localStorage
        localStorage.setItem('refresh_jwt', resp.refreshToken.token);
        this.scheduleRenewal();
        return resp;
      })
    );
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
  setCookie(name, value, days = 30) {
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + (value || '') + expires + '; path=/';
  }
  getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let c of ca) {
      while (c.charAt(0) === ' ') {
        c = c.substring(1, c.length);
      }
      if (c.indexOf(nameEQ) === 0) {
        return c.substring(nameEQ.length, c.length);
      }
    }
    return null;
  }
  eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;';
  }
}
