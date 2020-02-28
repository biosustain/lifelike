import { Injectable } from '@angular/core';

import { MatSnackBar } from '@angular/material';

import {
    Actions,
    ofType,
    createEffect,
} from '@ngrx/effects';

import { map, tap } from 'rxjs/operators';

import { displaySnackbar } from './snackbar-actions';

@Injectable()
export class SharedNgrxEffects {
    constructor(
        private actions$: Actions,
        private snackBar: MatSnackBar,
    ) {}

    displaySnackbar$ = createEffect(() => this.actions$.pipe(
      ofType(displaySnackbar),
      map(action => action.payload),
      tap(payload => this.snackBar.open(payload.message, payload.action, payload.config)
    )), {dispatch: false});
}
