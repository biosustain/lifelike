import { ActivatedRouteSnapshot } from '@angular/router';

import { flatMap, transform, forOwn } from 'lodash-es';

import { RelativeURL } from './url';

export const getURLFromSnapshot = (route: ActivatedRouteSnapshot, base?) => {
  const snapshotURL = new RelativeURL(
    flatMap(route.pathFromRoot, ({url}) => url).map(segment => `/${segment}`).join('')
  );
  forOwn(route.queryParams, snapshotURL.searchParams.set);
  snapshotURL.hash = route.fragment;
  return snapshotURL;
};
