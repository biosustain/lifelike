import { createAction, props } from '@ngrx/store';

import { UpdateUserRequest } from 'app/interfaces';

export const updateUser = createAction(
  '[User] Update User',
  props<{ userUpdates: UpdateUserRequest }>(),
);

export const updateUserSuccess = createAction(
  '[User] Update User Success',
);
