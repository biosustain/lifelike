import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { select, Store } from '@ngrx/store';
import { State } from 'app/root-store';

import * as AuthActions from 'app/auth/store/actions';
import { AuthSelectors } from 'app/auth/store';
import { Observable } from 'rxjs';

import { AppUser } from 'app/interfaces';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  appuser$: Observable<AppUser>;
  loggedIn$: Observable<boolean>;

  constructor(
    private store: Store<State>,
    private router: Router,
  ) {
    this.loggedIn$ = store.pipe(select(AuthSelectors.selectAuthLoginState));
    this.appuser$ = store.pipe(select(AuthSelectors.selectAuthUser));
  }

  login() {
    this.router.navigate(['/login']);
  }

  logout() {
    this.store.dispatch(AuthActions.logout());
  }

}
