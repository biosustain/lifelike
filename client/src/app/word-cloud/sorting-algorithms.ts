export interface SortingAlgorithm {
  id: string;
  description: string;
  valueDescription: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export const sortingAlgorithms: SortingAlgorithm[] = [
  {
    id: 'frequency',
    description: 'Occurrence count',
    valueDescription: 'Entity Frequency',
    min: 0,
    step: 1,
    default: 1
  },
  {
    id: 'sum_log_count',
    description: 'Log transformed count',
    valueDescription: 'Sum log of frequency per file',
    min: 0,
    step: 0.1,
    default: 0
  },
  {
    id: 'mwu',
    description: 'Mann–Whitney U test',
    valueDescription: '-log(p-value)',
    min: 0,
    step: 0.25,
    default: 0
  }
];

export const defaultSortingAlgorithm = sortingAlgorithms[0];
