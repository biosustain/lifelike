export interface SortingAlgorithm {
  id: string;
  description: string;
  valueDescription: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export const SortingAlgoritms: SortingAlgorithm[] = [
  {
    id: 'sum_log_count',
    description: 'Arbitrary (sum(log(count))))',
    valueDescription: 'Sum log of frequency per file',
    min: 0,
    step: 0.1,
    default: 0
  },
  {
    id: 'frequency',
    description: 'Occurrence count',
    valueDescription: 'Entity Frequency',
    min: 0,
    step: 1,
    default: 1
  }
];

export const DefaultSortingAlgorithm = SortingAlgoritms[0];
