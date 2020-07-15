import { Component } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { select, Store } from '@ngrx/store';
import { State } from 'app/***ARANGO_USERNAME***-store';

import * as AuthActions from 'app/auth/store/actions';
import { AuthSelectors } from 'app/auth/store';
import { Observable } from 'rxjs';

import { AppUser } from 'app/interfaces';
import { Title } from '@angular/platform-browser';
import { NgbModalConfig, NgbPaginationConfig } from '@ng-bootstrap/ng-bootstrap';

/**
 * Root of the application that creates the left menu and the content section.
 */
@Component({
  selector: 'app-***ARANGO_USERNAME***',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  readonly appUser$: Observable<AppUser>;
  readonly userRoles$: Observable<string[]>;
  readonly loggedIn$: Observable<boolean>;

  constructor(
    private readonly store: Store<State>,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly titleService: Title,
    private readonly ngbModalConfig: NgbModalConfig,
    private readonly ngbPaginationConfig: NgbPaginationConfig,
  ) {
    this.ngbModalConfig.backdrop = 'static';
    this.ngbPaginationConfig.maxSize = 5;

    this.loggedIn$ = store.pipe(select(AuthSelectors.selectAuthLoginState));
    this.appUser$ = store.pipe(select(AuthSelectors.selectAuthUser));
    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));

    // Set the title of the document based on the route
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const child = this.activatedRoute.firstChild;
        titleService.setTitle(child.snapshot.data.title ? `Lifelike: ${child.snapshot.data.title}` : 'Lifelike');
      }
    });
  }

  /**
   * Navigate to the login page.
   */
  login() {
    this.router.navigate(['/login']);
  }

  /**
   * Log the user out.
   */
  logout() {
    this.store.dispatch(AuthActions.logout());
  }
}
