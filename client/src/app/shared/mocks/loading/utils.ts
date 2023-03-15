import { random } from 'lodash-es';

export const LOADING = 'Loading';

export const loadingText = () => Array(random(2, 3)).fill(LOADING).join(' ');
