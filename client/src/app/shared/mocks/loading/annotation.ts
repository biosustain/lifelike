import { pick as _pick } from 'lodash-es';

import { GlobalAnnotationListItem } from 'app/interfaces/annotation';
import {
  AnnotationExclusionChangeData,
  AnnotationInclusionChangeData,
  FileAnnotationChangeData,
  AnnotationChangeData,
  FileAnnotationHistoryResponse,
} from 'app/file-browser/schema';
import { AppUser } from 'app/interfaces';
import { AddedAnnotationExclusion, Links, Meta, Rect, AnnotationChangeExclusionMeta } from 'app/pdf-viewer/annotation-type';

import { freezeDeep } from '../../utils';
import { ResultList } from '../../schemas/common';
import { appUserLoadingMock } from './user';
import { LOADING, loadingText, INDEX } from './utils';

export const globalAnnotationListItemLoadingMock: () => GlobalAnnotationListItem = () => ({
    globalId: INDEX,
    fileUuid: LOADING,
    creator: LOADING,
    fileDeleted: false,
    type: LOADING,
    creationDate: LOADING,
    text: loadingText(),
    caseInsensitive: false,
    entityType: LOADING,
    entityId: LOADING,
    reason: loadingText(),
    comment: loadingText()
});

export const addedAnnotationExclusionLoadingMock: AddedAnnotationExclusion = {
  type: LOADING,
  text: loadingText(),
  id: LOADING,
  idHyperlinks: [
    LOADING,
    LOADING
  ],
  reason: LOADING,
  comment: loadingText(),
  rects: [],
  pageNumber: INDEX,
  excludeGlobally: false,
  isCaseInsensitive: false
};

export const annotationChangeDataLoadingMock: AnnotationChangeData = {
  action: 'added' // | 'removed';
};

export const metaLoadingMock: Meta = {
  type: LOADING,
  allText: LOADING
};

export const annotationChangeExclusionMetaLoadingMock: AnnotationChangeExclusionMeta = _pick(
  addedAnnotationExclusionLoadingMock,
  ['id' , 'idHyperlinks' , 'text' , 'type' , 'reason' , 'comment' ,
  'excludeGlobally' , 'isCaseInsensitive']
);

export const annotationInclusionChangeDataLoadingMock: AnnotationInclusionChangeData = {
  ...annotationChangeDataLoadingMock,
  meta: metaLoadingMock
};

export const annotationExclusionChangeDataLoadingMock: AnnotationExclusionChangeData = {
  ...annotationChangeDataLoadingMock,
  meta: annotationChangeExclusionMetaLoadingMock
};


export const fileAnnotationChangeDataLoadingMock: FileAnnotationChangeData = {
  date: 'XX/XX/XX XX:XX XX',
  user: appUserLoadingMock,
  cause: 'user',
  inclusionChanges: [
    annotationInclusionChangeDataLoadingMock,
    annotationInclusionChangeDataLoadingMock
  ],
  exclusionChanges: [
    annotationExclusionChangeDataLoadingMock,
    annotationExclusionChangeDataLoadingMock
  ]
};

export const fileAnnotationHistoryResponseLoadingMock: FileAnnotationHistoryResponse = {
  total: 2,
  results: [
    fileAnnotationChangeDataLoadingMock,
    fileAnnotationChangeDataLoadingMock,
  ]
};
