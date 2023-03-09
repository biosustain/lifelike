import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { ModuleAwareComponent } from 'app/shared/modules';
import { removeViewModeIfPresent } from 'app/shared/utils/browser';
import { AppURL } from 'app/shared/utils/url';

/**
 * Endpoints to manage with the filesystem exposed to the user.
 */
@Injectable({ providedIn: "***ARANGO_USERNAME***" })
export class ViewService {
  constructor(protected readonly http: HttpClient) {}

  get(viewId: string): Observable<object> {
    return this.http.get(`/api/view/${encodeURIComponent(viewId)}`);
  }

  /**
   * Given set of params saves them in DB and returns row UUID
   * @param params arbitrary JSON parsable object
   */
  create(params: object) {
    return this.http.post(`/api/view/`, params, {
      responseType: "text",
    });
  }

  getAppLink(componentInstance: ModuleAwareComponent, url: string): Observable<AppURL> {
    url = removeViewModeIfPresent(url);
    const hashUrl = new AppURL(url);
    const linkParamsPromise = (componentInstance as ModuleAwareComponent)?.linkParams;
    if (linkParamsPromise) {
      return from(linkParamsPromise).pipe(
        map((linkParams) => {
          hashUrl.setSearch(linkParams);
          return hashUrl;
        })
      );
    }
    return of(hashUrl);
  }

  getShareableLink(componentInstance: ModuleAwareComponent, url: string): Observable<AppURL> {
    return this.getAppLink(componentInstance, url).pipe(
      map((appUrl: AppURL) => appUrl.toAbsolute())
    );
  }
}
