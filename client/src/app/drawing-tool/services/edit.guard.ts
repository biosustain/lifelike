import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { Store } from '@ngrx/store';

import { ProjectsService } from '.';
import { State } from 'app/root-store';
import { SnackbarActions } from 'app/shared/store';

@Injectable({
  providedIn: 'root'
})
export class EditGuard implements CanActivate {

  constructor(
    private projService: ProjectsService,
    private router: Router,
    private store: Store<State>,
  ) { }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ) {
    const hashId = route.paramMap.get('hash_id');

    interface MapMeta {
      userOwnIt: boolean;
      isItPublic: boolean;
    }

    return this.projService.canIEdit(hashId)
      .pipe(
        map(
          (resp: MapMeta) => {
            const {
              userOwnIt,
              isItPublic
            } = resp;

            if (userOwnIt) {
              // If user owns the map
              return true;
            } else if (isItPublic) {
              // If user doesn't own map, but it's public
              this.router.navigateByUrl(`dt/map/${hashId}`);
              return false;
            } else {
              // If user doesn't own either map
              // nor is it public
              this.store.dispatch(SnackbarActions.displaySnackbar({payload: {
                message: 'Such a map does not exist',
                action: 'Dismiss',
                config: { duration: 10000 },
              }}));
              this.router.navigateByUrl('dt/map');
              return false;
            }
          }
        ),
        catchError((err) => {
          // If error, simulate 404 msg through snackbar
          this.store.dispatch(SnackbarActions.displaySnackbar({payload: {
            message: 'Such a map does not exist',
            action: 'Dismiss',
            config: { duration: 10000 },
          }}));
          this.router.navigateByUrl('dt/map');
          return of(false);
        })
      );
  }
}
