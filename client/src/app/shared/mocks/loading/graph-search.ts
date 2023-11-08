import { FTSQueryRecord, GraphNode } from 'app/interfaces';

import { INDEX, loadingText } from './utils';

export const fTSQueryRecordLoadingMock: () => FTSQueryRecord = () =>
  ({
    node: {
      id: INDEX,
      label: loadingText(),
      subLabels: [],
      displayName: loadingText(),
      domainLabels: [],
      entityUrl: loadingText(),
    },
    goClass: loadingText(),
    taxonomyId: INDEX,
    taxonomyName: loadingText(),
  } as FTSQueryRecord);
