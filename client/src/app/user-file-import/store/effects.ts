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

import { EMPTY, of } from 'rxjs';

import {
    getDbLabels,
    getDbLabelsSuccess,
    getNodeProperties,
    getNodePropertiesSuccess,
    uploadExperimentalDataFile,
    uploadExperimentalDataFileSuccess,
    uploadNodeMapping,
    uploadNodeMappingSuccess,
    getDbRelationshipTypes,
    getDbRelationshipTypesSuccess,
} from './actions';

import { displaySnackbar } from 'app/shared/store/snackbar-actions';

import { UserFileImportService } from '../services/user-file-import.service';
import { ServerError } from 'app/interfaces';

@Injectable()
export class UserFileImportEffects {
    constructor(
        private actions$: Actions,
        private fileImportService: UserFileImportService,
    ) {}

    getDbLabels$ = createEffect(() => this.actions$.pipe(
        ofType(getDbLabels),
        map(action => action),
        switchMap(() => this.fileImportService.getDbLabels()
            .pipe(
                map(labels => getDbLabelsSuccess({payload: labels})),
            ),
        ),
    ));

    getDbRelationshipTypes$ = createEffect(() => this.actions$.pipe(
        ofType(getDbRelationshipTypes),
        map(action => action),
        switchMap(() => this.fileImportService.getDbRelationshipTypes()
            .pipe(
                map(relationshipTypes => getDbRelationshipTypesSuccess({payload: relationshipTypes})),
            ),
        ),
    ));

    getNodeProperties$ = createEffect(() => this.actions$.pipe(
        ofType(getNodeProperties),
        map(action => action.payload),
        switchMap(nodeLabel => this.fileImportService.getNodeProperties(nodeLabel)
            .pipe(
                map(props => getNodePropertiesSuccess({payload: props})),
            ),
        ),
    ));

    uploadExperimentalDataFile$ = createEffect(() => this.actions$.pipe(
        ofType(uploadExperimentalDataFile),
        map(action => action.payload),
        switchMap(data => this.fileImportService.uploadExperimentalDataFile(data)
            .pipe(
                map(parsed => uploadExperimentalDataFileSuccess({payload: parsed})),
                catchError(() => EMPTY),
            ),
        ),
    ));

    uploadNodeMapping$ = createEffect(() => this.actions$.pipe(
        ofType(uploadNodeMapping),
        map(action => action.payload),
        switchMap(data => this.fileImportService.uploadNodeMapping(data)
            .pipe(
                mergeMap(() => [
                    uploadNodeMappingSuccess(),
                    displaySnackbar({payload: {
                        message: 'Upload success',
                        action: 'Dismiss',
                        config: {duration: 3000},
                    }}),
                    // TODO: redirect to show graph of uploaded data
                ]),
                catchError((errors: ServerError) => of(displaySnackbar({payload: {
                    message: errors.apiHttpError.message,
                    action: 'Dismiss',
                    config: {duration: 3000},
                }}))),
            ),
        ),
    ));
}
