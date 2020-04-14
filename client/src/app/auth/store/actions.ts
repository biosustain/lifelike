import { createAction, props } from '@ngrx/store';

import { AppUser, Credential } from 'app/interfaces';
import { LOGOUT_SUCCESS } from 'app/constants';

export const login = createAction(
    '[Auth] Login',
    props<{credential: Credential}>(),
);

export const loginSuccess = createAction(
    '[Auth] Login Success',
    props<{user: AppUser}>(),
);

export const loginFailure = createAction(
    '[Auth] Login Failure',
);

/** A login redirect carries the original requested url */
export const loginRedirect = createAction(
    '[Auth] Login Redirect',
    props<{url: string}>(),
);

export const logout = createAction(
    '[Auth] Logout'
);

/** Used when an update is performed on a logged in user */
export const refreshUser = createAction(
    '[Auth] Refresh User',
    props<{user: AppUser}>(),
);

export const logoutSuccess = createAction(LOGOUT_SUCCESS);
