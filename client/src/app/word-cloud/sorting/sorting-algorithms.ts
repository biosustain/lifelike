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
    description: 'Word size will be adjusted by number of times it has been annotated in project files.',
    valueDescription: 'Entity Frequency',
    min: 0,
    step: 1,
    default: 1,
  },
  {
    id: SortingAlgorithmId.sum_log_count,
    name: 'Log transformed count',
    // title: 'No title',
    description: `
    Word size will be adjusted by sum of log transformed count of times it has been mentioned in each paper.<br/>
    This method mitigates an issue of "Occurrence count" where repeated mentions in one publication would falsely emphasise term relevance for whole project.
    `,
    valueDescription: 'Sum log of frequency per file',
    min: 0,
    step: 0.1,
    default: 0,
  },
  {
    id: SortingAlgorithmId.mwu,
    name: 'Mann–Whitney U test',
    // title: 'Title for description',
    description: `
    This method uses Mann–Whitney U test quantify if term mention distribution differentiate from the whole dataset.<br/>
    The words becomes scaled by minus log of p-value to emphasise results close to 0.
    `,
    valueDescription: '-log(p-value)',
    min: 0,
    step: 0.25,
    default: 0,
  },
];

export const defaultSortingAlgorithm = sortingAlgorithms.find(
  sa => sa.id === SortingAlgorithmId.frequency,
);
