import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { OAuthErrorEvent, OAuthService } from 'angular-oauth2-oidc';
import { every } from 'lodash-es';
import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, EMPTY, Observable } from 'rxjs';
import { catchError, filter, map } from 'rxjs/operators';

import { State } from 'app/auth/store/state';
import { ErrorResponse } from 'app/shared/schemas/common';
import { SnackbarActions } from 'app/shared/store';
import { AccountService } from 'app/users/services/account.service';

import { AuthActions } from '../store';

@Injectable({ providedIn: '***ARANGO_USERNAME***' })
export class LifelikeOAuthService {
  private isAuthenticatedSubject$ = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject$.asObservable();

  private isDoneLoadingSubject$ = new BehaviorSubject<boolean>(false);
  public isDoneLoading$ = this.isDoneLoadingSubject$.asObservable();

  /**
   * Publishes `true` if and only if (a) all the asynchronous initial
   * login calls have completed or errorred, and (b) the user ended up
   * being authenticated.
   *
   * In essence, it combines:
   *
   * - the latest known state of whether the user is authorized
   * - whether the ajax calls for initial log in have all been done
   */
  public canActivateProtectedRoutes$: Observable<boolean> = combineLatest([
    this.isAuthenticated$,
    this.isDoneLoading$,
  ]).pipe(map(every));

  private navigateToLoginPage() {
    this.router.navigateByUrl('/login');
  }

  constructor(
    private oauthService: OAuthService,
    private accountService: AccountService,
    private router: Router,
    private location: Location,
    private readonly store$: Store<State>
  ) {
    // // This is tricky, as it might cause race conditions (where access_token is set in another tab before everything is said and done
    // there.
    // // TODO: Improve this setup. See: https://github.com/jeroenheijmans/sample-angular-oauth2-oidc-with-auth-guards/issues/2
    window.addEventListener('storage', (event) => {
      // The `key` is `null` if the event was caused by `.clear()`
      if (event.key !== 'access_token' && event.key !== null) {
        return;
      }

      console.warn(
        'Noticed changes to access_token (most likely from another tab), updating isAuthenticated'
      );
      this.isAuthenticatedSubject$.next(this.oauthService.hasValidAccessToken());

      if (!this.oauthService.hasValidAccessToken()) {
        this.store$.dispatch(AuthActions.oauthLogout());
      }
    });

    this.oauthService.events.subscribe((_) => {
      this.isAuthenticatedSubject$.next(this.oauthService.hasValidAccessToken());
    });

    this.oauthService.events
      .pipe(filter((e) => ['token_received'].includes(e.type)))
      .subscribe(() => this.oauthService.loadUserProfile());

    this.oauthService.events
      .pipe(filter((e) => ['session_terminated', 'session_error'].includes(e.type)))
      .subscribe(() => this.navigateToLoginPage());

    this.oauthService.setupAutomaticSilentRefresh();
  }

  runInitialLoginSequence(): Promise<void> {
    // 0. LOAD CONFIG:
    // First we have to check to see how the IdServer is currently configured:
    return (
      this.oauthService
        .loadDiscoveryDocument()

        // 1. HASH LOGIN:
        // Try to log in via hash fragment after redirect back from IdServer from initImplicitFlow:
        .then(() => this.oauthService.tryLogin())

        .then(() => {
          if (this.oauthService.hasValidAccessToken()) {
            const payload = this.oauthService.getIdentityClaims() as any;
            const oauthLoginData = {
              subject: payload.sub,
              firstName: payload.first_name || payload.given_name || payload.name,
              lastName: payload.last_name || payload.family_name,
              username: payload.username || payload.preferred_username,
            };

            this.store$.dispatch(AuthActions.oauthLogin({ oauthLoginData }));
            return this.accountService
              .getUserBySubject(payload.sub)
              .pipe(
                map((user) => {
                  this.store$.dispatch(
                    AuthActions.oauthLoginSuccess({ ***ARANGO_DB_NAME***User: user, oauthUser: oauthLoginData })
                  );
                }),
                catchError((err: HttpErrorResponse) => {
                  // If for some reason we can't retrieve the user from the database after authenticating, log them out and return to the home
                  // page. Also, see the below Github issue:
                  //    https://github.com/manfredsteyer/angular-oauth2-oidc/issues/9
                  // `logOut(true)` will log the user out of Lifelike, but *not* out of the identity provider (e.g. the Keycloak server). The
                  // likelihood of this error block occurring is probably very small (maybe the appserver went down temporarily), so ideally
                  // we should make it as easy as possible to get the user logged in. This way, hopefully they will be able to wait a few moments
                  // and refresh their browser to log in successfully.
                  const error = (err.error as ErrorResponse).message;
                  this.logout(true);
                  this.router.navigateByUrl('/dashboard');

                  this.store$.dispatch(
                    SnackbarActions.displaySnackbar({
                      payload: {
                        message: error,
                        action: 'Dismiss',
                        config: { duration: 10000 },
                      },
                    })
                  );
                  return EMPTY;
                })
              )
              .toPromise()
              .then(() => Promise.resolve());
          }

          // 2. SILENT LOGIN:
          // Try to log in via a refresh because then we can prevent needing to redirect the user:
          return this.oauthService
            .silentRefresh()
            .then(() => Promise.resolve())
            .catch((result: OAuthErrorEvent) => {
              // Subset of situations from https://openid.net/specs/openid-connect-core-1_0.html#AuthError
              // Only the ones where it's reasonably sure that sending the user to the IdServer will help.
              const errorResponsesRequiringUserInteraction = [
                'interaction_required',
                'login_required',
                'account_selection_required',
                'consent_required',
              ];
              const reason: any = result.reason;

              if (
                result &&
                reason &&
                errorResponsesRequiringUserInteraction.indexOf(reason.params.error) >= 0
              ) {
                // 3. USER MUST LOGIN:
                // At this point we know for sure that we have to ask the user to log in, so we initiate the log out flow. They will need to
                // manually log themselves in afterwards.

                this.store$.dispatch(AuthActions.oauthLogout());

                // To immediately redirect them to the login server, comment the above and uncomment the below:
                // this.login()

                // Instead, we'll now do this:
                return Promise.resolve();
              }

              // We can't handle the truth, just pass on the problem to the next handler.
              return Promise.reject(result);
            });
        })

        .then(() => {
          this.isDoneLoadingSubject$.next(true);

          // Check for the strings 'undefined' and 'null' just to be sure. Our current login(...) should never have this, but in case someone
          // ever calls initImplicitFlow(undefined | null) this could happen.
          if (
            this.oauthService.state &&
            this.oauthService.state !== 'undefined' &&
            this.oauthService.state !== 'null'
          ) {
            let stateUrl = this.oauthService.state;
            if (stateUrl.startsWith('/') === false) {
              stateUrl = decodeURIComponent(stateUrl);
            }
            this.router.navigateByUrl(stateUrl);
          }
        })
        .catch(() => this.isDoneLoadingSubject$.next(true))
    );
  }

  login(targetUrl?: string) {
    this.oauthService.initLoginFlow(targetUrl || this.location.path());
  }

  logout(revokeAll: boolean = false, redirectUrl: string = '') {
    this.oauthService.logOut(revokeAll, redirectUrl);
  }
  refresh() {
    this.oauthService.silentRefresh();
  }
  hasValidToken() {
    return this.oauthService.hasValidAccessToken();
  }
}
