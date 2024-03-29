import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { LifelikeOAuthService } from '../services/oauth.service';
import { environment } from '../../../environments/environment';
import { AuthenticationService } from '../services/authentication.service';
/**
 * Check if the user is already logged in when they access login page,
 * redirect to home if yes.
 */

@Injectable()
export class LoginGuard implements CanActivate {
  constructor(
    private authService: AuthenticationService,
    private router: Router,
    private oauthService: LifelikeOAuthService
  ) {}

  canActivate({}: ActivatedRouteSnapshot, {}: RouterStateSnapshot): Observable<boolean> {
    return this.authService.loggedIn$.pipe(
      map((loggedIn) => {
        if (loggedIn) {
          this.router.navigate(['/']);
          return false;
        } else {
          if (environment.oauthEnabled) {
            this.oauthService.login();
            return false; // Probably redundant, since the `login` call above redirects out of the app anyway...
          }
        }
        return true;
      }),
      take(1)
    );
  }
}
