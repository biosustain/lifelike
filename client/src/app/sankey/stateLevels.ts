import { pick } from 'lodash-es';

import { SankeyState } from './interfaces';

export const reduceState = (state, keys) => {
  return pick(state, keys);
};

export const composeState = (states) => {
  return Object.assign({}, ...states);
};

const SANKEY_STATE_KEYS: Array<keyof SankeyState> = [
  'networkTraceIdx',
  'nodeAlign',
  'networkTraceIdx',
  'prescalerId',
  'normalizeLinks',
  'labelEllipsis',
  'fontSizeScale',
  'viewName',
  'baseViewName',
];

export const getCommonState = (state) => pick(state, SANKEY_STATE_KEYS);
export const getBaseState = (state) => pick(state, SANKEY_STATE_KEYS);
