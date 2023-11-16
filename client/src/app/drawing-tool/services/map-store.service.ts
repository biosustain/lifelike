import { Injectable } from '@angular/core';

import { RxjsStore } from 'app/shared/rxjs/store';

interface State {
  context: string | undefined;
}

export enum ActionTypes {
  SET_CONTEXT = 'SET_CONTEXT',
}

export interface SetContextAction {
  type: ActionTypes.SET_CONTEXT;
  payload: string | undefined;
}

// Union of actions
export type Actions = SetContextAction;

export const setContext = (context: string | undefined): SetContextAction => ({
  type: ActionTypes.SET_CONTEXT,
  payload: context,
});

@Injectable()
export class MapStoreService extends RxjsStore<State, Actions> {
  constructor() {
    super(
      {
        context: undefined,
      },
      [
        (state, action) => {
          if (action.type === ActionTypes.SET_CONTEXT) {
            return {
              ...state,
              context: action.payload,
            };
          }
          return state;
        },
      ]
    );
  }
}
