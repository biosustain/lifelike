import { Component } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { select, Store } from '@ngrx/store';
import { State } from 'app/***ARANGO_USERNAME***-store';

import * as AuthActions from 'app/auth/store/actions';
import { AuthSelectors } from 'app/auth/store';
import { Observable } from 'rxjs';

import { AppUser } from 'app/interfaces';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-***ARANGO_USERNAME***',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  appuser$: Observable<AppUser>;
  userRoles$: Observable<string[]>;
  loggedIn$: Observable<boolean>;

  constructor(
    private store: Store<State>,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private titleService: Title,
  ) {
    this.loggedIn$ = store.pipe(select(AuthSelectors.selectAuthLoginState));
    this.appuser$ = store.pipe(select(AuthSelectors.selectAuthUser));
    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const child = this.activatedRoute.firstChild;
        titleService.setTitle(child.snapshot.data.title ? `Lifelike: ${child.snapshot.data.title}` : 'Lifelike');
      }
    });
  }

  login() {
    this.router.navigate(['/login']);
  }

  logout() {
    this.store.dispatch(AuthActions.logout());
  }

}
