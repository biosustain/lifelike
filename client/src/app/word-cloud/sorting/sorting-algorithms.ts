export enum SortingAlgorithmId {
  frequency = 'frequency',
  sum_log_count = 'sum_log_count',
  mwu = 'mwu'
}

export interface SortingAlgorithm {
  id: SortingAlgorithmId;
  name: string;
  title?: string;
  description?: string;
  valueDescription: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export const sortingAlgorithms: SortingAlgorithm[] = [
  {
    id: SortingAlgorithmId.frequency,
    name: 'Occurrence count',
    title: 'Occurrence count',
    // description: 'No description',
    valueDescription: 'Entity Frequency',
    min: 0,
    step: 1,
    default: 1,
  },
  {
    id: SortingAlgorithmId.sum_log_count,
    name: 'Log transformed count',
    // title: 'No title',
    description: 'No title. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin mattis posuere diam, ut fringilla leo scelerisque non. Suspendisse a rutrum nibh, vitae condimentum lectus. Curabitur ac tortor ipsum. Proin fringilla.',
    valueDescription: 'Sum log of frequency per file',
    min: 0,
    step: 0.1,
    default: 0,
  },
  {
    id: SortingAlgorithmId.mwu,
    name: 'Mann–Whitney U test',
    title: 'Title for description',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce ultricies aliquet risus, nec lacinia justo pretium luctus. Quisque ut lorem eget sapien commodo ultricies. Donec a feugiat arcu, in egestas augue. Duis tempor a neque sit amet condimentum. Quisque luctus.',
    valueDescription: '-log(p-value)',
    min: 0,
    step: 0.25,
    default: 0,
  },
];

export const defaultSortingAlgorithm = sortingAlgorithms.find(
  sa => sa.id === SortingAlgorithmId.frequency,
);
