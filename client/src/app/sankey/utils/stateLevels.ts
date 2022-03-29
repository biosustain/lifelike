import { omit, transform } from 'lodash-es';

import { SankeyState } from '../interfaces';

export const reduceState = (state, keys) => {
  return pick(state, keys);
};

export const composeState = (states) => {
  return Object.assign({}, ...states);
};

const SANKEY_STATE_KEYS: Array<keyof SankeyState> = [
  'networkTraceIdx',
  'networkTraceIdx',
  'prescalerId',
  'normalizeLinks',
  'labelEllipsis',
  'fontSizeScale',
  'viewName',
  'baseViewName',
  'alignId'
];

// Have had problem with lodash pick in here, so used object transformation instead
export const getCommonState = state => transform(
  state,
  (result, value, key: keyof SankeyState) => {
    if (SANKEY_STATE_KEYS.includes(key)) {
      result[key] = value;
    }
  },
  {}
);
export const getBaseState = state => omit(state, SANKEY_STATE_KEYS);
