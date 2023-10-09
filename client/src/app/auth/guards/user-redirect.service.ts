import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';

import { select, Store } from '@ngrx/store';
import { switchMap } from 'rxjs/operators';

import { AppUser } from 'app/interfaces';
import { wrapIntoObservable } from 'app/shared/rxjs/wrapIntoObservable';

import { State } from '../store/state';
import { AuthSelectors } from '../store';

@Injectable()
export class UserRedirectGuard implements CanActivate {
  activatedRoute: ActivatedRouteSnapshot;
  redirectUrl: string;

  constructor(
    private store: Store<State>,
    private router: Router,
    private redirect: (arg: {
      user: AppUser;
      active: ActivatedRouteSnapshot;
      state: RouterStateSnapshot;
    }) => ReturnType<CanActivate['canActivate']>
  ) {}

  canActivate(active: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.store.pipe(
      select(AuthSelectors.selectAuthLoginStateAndUser),
      switchMap(({ user }) => wrapIntoObservable(this.redirect({ user, active, state })))
    );
  }
}
