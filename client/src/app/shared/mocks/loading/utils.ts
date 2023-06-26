import { random as _random } from 'lodash-es';

export const LOADING = 'Loading';

export const INDEX = -1;

export const DATE = '0/01/92, 7:00 PM';

export const FA_ICON = 'fas fa-circle-notch fa-spin text-muted';

export const mockArrayOf = <T>(itemFactory: () => T, minLength = 2, maxLength = 3) =>
  Array(_random(minLength, maxLength))
    .fill(undefined)
    .map(() => itemFactory());

export const loadingText = (wordsMin = 2, wordsMax = 3) => mockArrayOf(() => LOADING).join(' ');

export const timestampLoadingMock = () => Date.now();
