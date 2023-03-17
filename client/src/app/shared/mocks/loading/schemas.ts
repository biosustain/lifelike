import { CollaboratorData } from 'app/file-browser/schema';

import { appUserLoadingMock } from './user';
import { LOADING } from './utils';

export const collaboratorDataLoadingMock: CollaboratorData = {
  user: appUserLoadingMock,
  roleName: LOADING
};
