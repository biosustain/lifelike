import {
    createFeatureSelector,
    createSelector,
} from '@ngrx/store';

import { State } from './state';

import * as fromAuth from './reducer';

export const selectAuthState = createFeatureSelector<State>(fromAuth.authFeatureKey);

export const selectAuthLoginState = createSelector(
    selectAuthState,
    fromAuth.getLoggedIn,
);

export const selectAuthUser = createSelector(
    selectAuthState,
    fromAuth.getUser,
);

export const selectAuthRedirectUrl = createSelector(
    selectAuthState,
    fromAuth.getTargetUrl,
);
