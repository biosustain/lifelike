import { ActivatedRouteSnapshot } from '@angular/router';

import { flatMap, transform, forOwn } from 'lodash-es';

import { AppURL } from './url';

export const getURLFromSnapshot = (route: ActivatedRouteSnapshot, base?) => {
  return new AppURL(
    flatMap(route.pathFromRoot, ({url}) => url).map(segment => `/${segment}`).join(''),
    {
      search: route.queryParams,
      hash: route.fragment
    }
  );
};
