import { Component } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { select, Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { NgbModal, NgbModalConfig, NgbPaginationConfig } from '@ng-bootstrap/ng-bootstrap';

import { State } from 'app/***ARANGO_USERNAME***-store';
import { downloader } from 'app/shared/utils';
import { StorageService } from 'app/shared/services/storage.service';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import * as AuthActions from 'app/auth/store/actions';
import { AuthSelectors } from 'app/auth/store';
import { AppUser } from 'app/interfaces';

import { AppVersionDialogComponent } from './app-version-dialog.component';

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
  helpDeskUrl = 'https://sbrgsoftware.atlassian.net/servicedesk/customer/portal/1/group/1/create/9';

  constructor(
    private readonly store: Store<State>,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly titleService: Title,
    private readonly modalService: NgbModal,
    private readonly ngbModalConfig: NgbModalConfig,
    private readonly ngbPaginationConfig: NgbPaginationConfig,
    private storage: StorageService,
    private authService: AuthenticationService,
  ) {
    this.ngbModalConfig.backdrop = 'static';
    this.ngbPaginationConfig.maxSize = 5;

    this.loggedIn$ = store.pipe(select(AuthSelectors.selectAuthLoginState));
    this.appUser$ = store.pipe(select(AuthSelectors.selectAuthUser));
    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));

    this.authService.scheduleRenewal();

    // Set the title of the document based on the route
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const child = this.activatedRoute.firstChild;
        titleService.setTitle(child.snapshot.data.title ? `Lifelike: ${child.snapshot.data.title}` : 'Lifelike');
      }
    });

  }
  /**
   * View Lifelike meta information
   */
  buildInfo() {
    this.modalService.open(AppVersionDialogComponent);
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

  downloadManual() {
    this.storage.getUserManual().subscribe(resp => {
      const filename = resp.headers.get('content-disposition').split('=')[1];
      downloader(resp.body, 'application/pdf', filename);
    });
  }
}
