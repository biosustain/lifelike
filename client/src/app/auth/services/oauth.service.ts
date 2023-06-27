import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

import { State } from 'app/auth/store/state';

import { OAuthErrorEvent, OAuthService } from 'angular-oauth2-oidc';
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
    this.isDoneLoading$
  ]).pipe(
    map(values => values.every(b => b)),
    tap(console.log)
  );

  private navigateToLoginPage() {
    console.log('navigateToLoginPage called');
    this.router.navigateByUrl('/login');
  }

  constructor(
    private oauthService: OAuthService,
    private router: Router,
    private location: Location,
    private readonly store$: Store<State>,
  ) {
    // // This is tricky, as it might cause race conditions (where access_token is set in another tab before everything is said and done
    // there.
    // // TODO: Improve this setup. See: https://github.com/jeroenheijmans/sample-angular-oauth2-oidc-with-auth-guards/issues/2
    window.addEventListener('storage', (event) => {
      console.log('window.addEventListener called on oauth.service.ts line 56')

      // The `key` is `null` if the event was caused by `.clear()`
      if (event.key !== 'access_token' && event.key !== null) {
        return;
      }

      console.warn('Noticed changes to access_token (most likely from another tab), updating isAuthenticated');
      this.isAuthenticatedSubject$.next(this.oauthService.hasValidAccessToken());

      if (!this.oauthService.hasValidAccessToken()) {
        console.log('Dispatching oauthLogout on line 68');
        this.store$.dispatch(AuthActions.oauthLogout());
      }
    });

    this.oauthService.events
      .subscribe(_ => {
        console.log(`Pushing value ${this.oauthService.hasValidAccessToken()} to isAuthenticatedSubject on line 75`);
        this.isAuthenticatedSubject$.next(this.oauthService.hasValidAccessToken());
    });

    this.oauthService.events
      .pipe(filter(e => ['token_received'].includes(e.type)))
      .subscribe(e => {
        console.log('Got token receieved event:');
        console.log(e);
        console.log('Loading user profile on line 82')
        this.oauthService.loadUserProfile()
      });

    this.oauthService.events
      .pipe(filter(e => ['session_terminated', 'session_error'].includes(e.type)))
      .subscribe(e => {
        console.log('Got either session_terminated or session_error event:');
        console.log(e);
        console.log('Loading user profile on line 82')
        this.navigateToLoginPage()
      });

    this.oauthService.setupAutomaticSilentRefresh();
  }

  runInitialLoginSequence(): Promise<void> {
    // 0. LOAD CONFIG:
    // First we have to check to see how the IdServer is currently configured:
    return this.oauthService.loadDiscoveryDocument()

      // 1. HASH LOGIN:
      // Try to log in via hash fragment after redirect back from IdServer from initImplicitFlow:
      .then(() => {
        console.log('Discovery document loaded, attempting login');
        return this.oauthService.tryLogin();
      })

      .then(() => {
        if (this.oauthService.hasValidAccessToken()) {
          const payload = (this.oauthService.getIdentityClaims() as any);

          console.log('User has valid access token, dispatching oauthLogin action on line 116')
          this.store$.dispatch(AuthActions.oauthLogin({
            oauthLoginData: {
              subject: payload.sub,
              firstName: payload.first_name || payload.given_name || payload.name,
              lastName: payload.last_name || payload.family_name,
              username: payload.username || payload.preferred_username,
            }
          }));
          return Promise.resolve();
        }

        console.log('User does not have a valid access token, attempting refresh')
        // 2. SILENT LOGIN:
        // Try to log in via a refresh because then we can prevent needing to redirect the user:
        return this.oauthService.silentRefresh()
          .then(() => {
            console.log('silent refresh successful, continuing');
            return Promise.resolve();
          })
          .catch((result: OAuthErrorEvent) => {
            console.log('Error occurred during silent refresh:');
            console.log(result);
            // Subset of situations from https://openid.net/specs/openid-connect-core-1_0.html#AuthError
            // Only the ones where it's reasonably sure that sending the user to the IdServer will help.
            const errorResponsesRequiringUserInteraction = [
              'interaction_required',
              'login_required',
              'account_selection_required',
              'consent_required',
            ];
            const reason: any = result.reason;

            if (result
              && reason
              && errorResponsesRequiringUserInteraction.indexOf(reason.params.error) >= 0) {

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
        console.log(`Pushing ${true} to isDoneLoadingSubject$ on line 172`);
        this.isDoneLoadingSubject$.next(true);

        // Check for the strings 'undefined' and 'null' just to be sure. Our current login(...) should never have this, but in case someone
        // ever calls initImplicitFlow(undefined | null) this could happen.
        if (this.oauthService.state && this.oauthService.state !== 'undefined' && this.oauthService.state !== 'null') {
          console.log('Conditional on line 176 was true');
          let stateUrl = this.oauthService.state;
          if (stateUrl.startsWith('/') === false) {
            console.log('Conditional on line 179 was true')
            stateUrl = decodeURIComponent(stateUrl);
          }
          console.log(`Calling navigateByUrl on line 184 with ${stateUrl}`)
          this.router.navigateByUrl(stateUrl);
        }
      })
      .catch(() => this.isDoneLoadingSubject$.next(true));
  }

  login(targetUrl?: string) {
    console.log(`Called login, calling initLoginFlow with ${targetUrl} or ${this.location.path}`)
    this.oauthService.initLoginFlow(targetUrl || this.location.path());
  }

  logout(revokeAll: boolean = false, redirectUrl: string = '') {
    console.log(`Called logout, calling logOut with ${revokeAll} or ${redirectUrl}`)
    this.oauthService.logOut(revokeAll, redirectUrl);
  }
  refresh() { this.oauthService.silentRefresh(); }
  hasValidToken() { return this.oauthService.hasValidAccessToken(); }
}
