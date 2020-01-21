import { Injectable } from '@angular/core';
import {
    Actions,
    ofType,
    createEffect,
} from '@ngrx/effects';

import {
    catchError,
    map,
    switchMap,
    mergeMap,
} from 'rxjs/operators';

import { EMPTY } from 'rxjs';

import {
    uploadNeo4jFile,
    uploadNeo4jFileSuccess,
    uploadNeo4jColumnMappingFile,
    uploadNeo4jColumnMappingFileSuccess,
} from './actions';

// import * as SnackbarActions from 'recon/shared/actions/snackbar-display.actions';

import { Neo4jService } from '../services/neo4j.service';


@Injectable()
export class Neo4jEffects {
    constructor(
        private actions$: Actions,
        private neo4jService: Neo4jService,
    ) {}

    uploadNeo4jFile = createEffect(() => this.actions$.pipe(
        ofType(uploadNeo4jFile),
        map(action => action.payload),
        switchMap(data => this.neo4jService.uploadNeo4jFile(data)
            .pipe(
                map(parsed => uploadNeo4jFileSuccess({payload: parsed})),
                catchError(() => EMPTY),
            ),
        ),
    ));

    uploadColumnMapping = createEffect(() => this.actions$.pipe(
        ofType(uploadNeo4jColumnMappingFile),
        map(action => action.payload),
        switchMap(data => this.neo4jService.uploadNeo4jColumnMappingFile(data)
            .pipe(
                mergeMap(() => [
                    uploadNeo4jColumnMappingFileSuccess(),
                    // new SnackbarActions.SnackbarOpen({
                    //     message: 'Done',
                    //     action: 'Dismiss',
                    //     snackConfig: { duration: 1000 },
                    // }),
                ]),
                catchError(() => EMPTY),
            ),
        ),
    ));
}
