import { mean } from 'lodash-es';

export function median(arr: number[]): number {
  const sortedArray = arr.sort((a, b) => a - b);
  const middleIndex = arr.length / 2;
  if (middleIndex % 1 === 0) {
    return sortedArray[middleIndex];
  } else {
    return mean(
      sortedArray.slice(
        Math.floor(middleIndex),
        Math.ceil(middleIndex)
      )
    );
  }
}
