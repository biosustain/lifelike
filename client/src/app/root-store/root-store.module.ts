import { NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import {
    ActionReducerMap,
    StoreModule,
} from '@ngrx/store';

import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { UserFileImportModule } from 'app/user-file-import/user-file-import.module';

import { environment } from '../../environments/environment';

import { State } from './state';



/**
 * Our state is composed of a map of action reducer functions.
 * These reducer functions are called with each dispatched action
 * and the current or initial state and return a new immutable state.
 */
export const reducers: ActionReducerMap<State> = {};


@NgModule({
    imports: [
        UserFileImportModule,
        /**
         * StoreModule.forRoot is imported once in the ***ARANGO_USERNAME*** module, accepting a reducer
         * function or object map of reducer functions. If passed an object of
         * reducers, combineReducers will be run creating your application
         * meta-reducer. This returns all providers for an @ngrx/store
         * based application.
         */
        StoreModule.forRoot(reducers),

        /**
         * Store devtools instrument the store retaining past versions of state
         * and recalculating new states. This enables powerful time-travel
         * debugging.
         *
         * To use the debugger, install the Redux Devtools extension for either
         * Chrome or Firefox
         *
         * See: https://github.com/zalmoxisus/redux-devtools-extension
         */
        StoreDevtoolsModule.instrument({
            name: 'KG Prototypes',
            logOnly: environment.production,
        }),

        /**
         * EffectsModule.forRoot() is imported once in the ***ARANGO_USERNAME*** module and
         * sets up the effects class to be initialized immediately when the
         * application starts.
         *
         * See: https://github.com/ngrx/platform/blob/master/docs/effects/api.md#for***ARANGO_USERNAME***
         */
        EffectsModule.forRoot([]),
    ],
    providers: [],
})
export class RootStoreModule {}
