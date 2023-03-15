import { AppUser } from 'app/interfaces';
import { RecursiveReadonly } from 'app/shared/utils/types';

import { freezeDeep } from '../../utils';

export const appUserLoadingMock: RecursiveReadonly<AppUser> = {
  /**
   * @deprecated
   */
  id: -1,
  hashId: 'Loading',
  /**
   * @deprecated
   */
  email: 'Loading',
  firstName: 'Loading',
  lastName: 'Loading',
  username: 'Loading',

  /**
   * @deprecated
   */
  roles: [],
};
