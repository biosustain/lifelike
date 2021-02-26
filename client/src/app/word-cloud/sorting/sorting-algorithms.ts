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
    name: 'Frequency',
    description: `
      Standard word cloud with word size determined from total word count.<br/>
      <p class="text-center m-2">𝙬𝙚𝙞𝙜𝙝𝙩 = 𝙨𝙪𝙢<sub>𝙞</sub> (𝙘𝙤𝙪𝙣𝙩<sub>𝙞</sub> )</p>
    `,
    valueDescription: 'Entity Frequency',
    min: 0,
    step: 1,
    default: 1,
  },
  {
    id: SortingAlgorithmId.sum_log_count,
    name: 'Log transformed frequency',
    // title: 'No title',
    description: `
    Log transformed counts. Method emphasizes terms appearing across multiple sources
    over similar counts collected from a single source.<br/>
    <p class="text-center m-2">𝙬𝙚𝙞𝙜𝙝𝙩 = 𝙨𝙪𝙢<sub>𝙞</sub> (𝙡𝙤𝙜 (𝙘𝙤𝙪𝙣𝙩<sub>𝙞</sub> ))</p>
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
    Each word are weighted according to a one-sided MWU test that assesses whether a count
    for that specific term tends to be larger than a count from any other term.<br/>
    <p class="text-center m-2">𝙬𝙚𝙞𝙜𝙝𝙩 = -𝙡𝙤𝙜 (𝙥 -𝙫𝙖𝙡𝙪𝙚 )</p>
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
