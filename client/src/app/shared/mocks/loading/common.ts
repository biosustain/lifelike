import { INDEX } from './utils';

export const rankedItemLoadingMock = <T>(item: T) => ({
  item,
  rank: INDEX,
});
