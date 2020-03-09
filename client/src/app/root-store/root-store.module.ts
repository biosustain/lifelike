import { NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import {
    ActionReducerMap,
    StoreModule,
} from '@ngrx/store';

import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { Neo4jModule } from 'app/upload/neo4j.module';

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
        Neo4jModule,
        /**
         * StoreModule.forRoot is imported once in the root module, accepting a reducer
         * function or object map of reducer functions. If passed an object of
         * reducers, combineReducers will be run creating your application
         * meta-reducer. This returns all providers for an @ngrx/store
         * based application.
         */
        StoreModule.forRoot(reducers, {
            // These are opt-in with NGRX 8, but will be on by default with the option to opt-out in future versions.
            // Karma also logs a bunch of warnings if we don't have them turned on.
            runtimeChecks: {
                strictStateImmutability: true,
                strictActionImmutability: true,
                strictStateSerializability: true,
                // setting to false because ngrx 8.6.0
                // prevents FormData and File objects
                // from being included in actions
                // as they're non-serializable
                // breaks file uploads
                strictActionSerializability: false,
              },
        }),

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
         * EffectsModule.forRoot() is imported once in the root module and
         * sets up the effects class to be initialized immediately when the
         * application starts.
         *
         * See: https://github.com/ngrx/platform/blob/master/docs/effects/api.md#forroot
         */
        EffectsModule.forRoot([]),
    ],
    providers: [],
})
export class RootStoreModule {}
