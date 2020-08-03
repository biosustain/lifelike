import { createAction, props } from '@ngrx/store';

import { AppUser, Credential } from 'app/interfaces';
import { LOGOUT_SUCCESS } from 'app/shared/constants';

export const checkTermsOfService = createAction(
    '[Auth] Check Terms Of Serivce',
    props<{credential: Credential}>(),
);

export const termsOfSerivceAgreeing = createAction(
    '[Auth] Open dialog to Terms Of Serivce',
);

export const agreeTermsOfService = createAction(
    '[Auth] Agree to Terms Of Serivce',
    props<{ credential: Credential, timeStamp: string }>()
);

export const disagreeTermsOfService = createAction(
    '[Auth] Disagree to Terms Of Serivce',
);

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

export const loginReset = createAction(
    '[Auth] Login Reset'
);


export const logoutSuccess = createAction(LOGOUT_SUCCESS);
