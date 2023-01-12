import { ActivatedRouteSnapshot } from '@angular/router';

import { flatMap, transform, forOwn } from 'lodash-es';

import { AppURL, HttpURL } from './url';

export const getURLFromSnapshot = (route: ActivatedRouteSnapshot, base?) =>
  new HttpURL({
    pathSegments: flatMap(route.pathFromRoot, ({url}) => url).map(segment => segment.toString()),
    search: route.queryParams,
    hash: route.fragment,
  });
