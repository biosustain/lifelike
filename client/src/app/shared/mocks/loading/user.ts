import { AppUser } from 'app/interfaces';
import { RecursiveReadonly } from 'app/shared/utils/types';

import { freezeDeep } from '../../utils';
import { LOADING } from './utils';

export const appUserLoadingMock: AppUser = {
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
};
