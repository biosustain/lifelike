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
    getDbLabels,
    getDbLabelsSuccess,
    getNodeProperties,
    getNodePropertiesSuccess,
    uploadNeo4jFile,
    uploadNeo4jFileSuccess,
    uploadNeo4jColumnMappingFile,
    uploadNeo4jColumnMappingFileSuccess,
} from './actions';

import { Neo4jService } from '../services/neo4j.service';


@Injectable()
export class Neo4jEffects {
    constructor(
        private actions$: Actions,
        private neo4jService: Neo4jService,
    ) {}

    getDbLabels = createEffect(() => this.actions$.pipe(
        ofType(getDbLabels),
        map(action => action),
        switchMap(() => this.neo4jService.getDbLabels()
            .pipe(
                map(labels => getDbLabelsSuccess({payload: labels})),
            ),
        ),
    ));

    getNodeProperties = createEffect(() => this.actions$.pipe(
        ofType(getNodeProperties),
        map(action => action.payload),
        switchMap(nodeLabel => this.neo4jService.getNodeProperties(nodeLabel)
            .pipe(
                map(props => getNodePropertiesSuccess({payload: props})),
            ),
        ),
    ));

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
