import { createAction, props } from '@ngrx/store';
import { AppUser, Credential } from 'app/interfaces';

export const login = createAction(
    '[Auth] Login',
    props<{credential: Credential}>(),
);

export const loginSuccess = createAction(
    '[Auth] Login Success',
    props<{user: AppUser}>(),
);

export const loginRedirect = createAction(
    '[Auth] Login Redirect',
);
