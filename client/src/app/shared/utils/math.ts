import { map as lodashMap } from 'lodash-es';

export function medianBy<T>(arr: T[], fn: (e: T) => number): number {
  const sortedArray = lodashMap(arr, fn).sort((a, b) => a - b);
  const middleIndex = sortedArray.length / 2;
  if (middleIndex % 1 === 0) {
    // Two middle numbers (e.g. [1, 2, 3, 4]), so to get the median take the average of the two
    return sortedArray.slice(
      middleIndex - 1,
      middleIndex + 1 // slice end is exclusive
    ).reduce((a, b) => a + b) / 2;
  } else {
    // middleIndex is "X.5", where the median index of the set is "X"
    return sortedArray[Math.floor(middleIndex)];
  }
}
