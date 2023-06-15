import { AppUser } from 'app/interfaces';
import { RecursiveReadonly } from 'app/shared/utils/types';
import { Collaborator } from 'app/file-browser/models/collaborator';

import { freezeDeep } from '../../utils';
import { LOADING } from './utils';

export const appUserLoadingMock: () => AppUser = () => ({
  /**
   * @deprecated
   */
  id: -1,
  hashId: LOADING,
  /**
   * @deprecated
   */
  email: LOADING,
  firstName: LOADING,
  lastName: LOADING,
  username: LOADING,

  /**
   * @deprecated
   */
  roles: [],
});

export const collaboratorLoadingMock: () => Collaborator = () =>
  new Collaborator().update({ user: appUserLoadingMock(), roleName: LOADING });
