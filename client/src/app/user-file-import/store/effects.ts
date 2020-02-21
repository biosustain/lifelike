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
    uploadNodeMapping,
    uploadNodeMappingSuccess,
    uploadRelationshipMapping,
    uploadRelationshipMappingSuccess,
    getDbRelationshipTypes,
    getDbRelationshipTypesSuccess,
} from './actions';

import { UserFileImportService } from '../services/user-file-import.service';


@Injectable()
export class UserFileImportEffects {
    constructor(
        private actions$: Actions,
        private fileImportService: UserFileImportService,
    ) {}

    getDbLabels = createEffect(() => this.actions$.pipe(
        ofType(getDbLabels),
        map(action => action),
        switchMap(() => this.fileImportService.getDbLabels()
            .pipe(
                map(labels => getDbLabelsSuccess({payload: labels})),
            ),
        ),
    ));

    getDbRelationshipTypes = createEffect(() => this.actions$.pipe(
        ofType(getDbRelationshipTypes),
        map(action => action),
        switchMap(() => this.fileImportService.getDbRelationshipTypes()
            .pipe(
                map(relationshipTypes => getDbRelationshipTypesSuccess({payload: relationshipTypes})),
            ),
        ),
    ));

    getNodeProperties = createEffect(() => this.actions$.pipe(
        ofType(getNodeProperties),
        map(action => action.payload),
        switchMap(nodeLabel => this.fileImportService.getNodeProperties(nodeLabel)
            .pipe(
                map(props => getNodePropertiesSuccess({payload: props})),
            ),
        ),
    ));

    uploadNeo4jFile = createEffect(() => this.actions$.pipe(
        ofType(uploadNeo4jFile),
        map(action => action.payload),
        switchMap(data => this.fileImportService.uploadNeo4jFile(data)
            .pipe(
                map(parsed => uploadNeo4jFileSuccess({payload: parsed})),
                catchError(() => EMPTY),
            ),
        ),
    ));

    uploadNodeMapping = createEffect(() => this.actions$.pipe(
        ofType(uploadNodeMapping),
        map(action => action.payload),
        switchMap(data => this.fileImportService.uploadNodeMapping(data)
            .pipe(
                mergeMap(() => [
                    uploadNodeMappingSuccess(),
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
