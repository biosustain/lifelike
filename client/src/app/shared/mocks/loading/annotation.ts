import { GlobalAnnotationListItem } from 'app/interfaces/annotation';

import { freezeDeep } from '../../utils';

export const globalAnnotationListItemLoadingMock: Readonly<GlobalAnnotationListItem> = freezeDeep({
    globalId: -1,
    fileUuid: 'Loading',
    creator: 'Loading',
    fileDeleted: false,
    type: 'Loading',
    creationDate: 'Loading',
    text: 'Loading Loading',
    caseInsensitive: false,
    entityType: 'Loading',
    entityId: 'Loading',
    reason: 'Loading Loading',
    comment: 'Loading Loading'
});
