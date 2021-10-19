import { Injectable } from '@angular/core';

import { Observable, of, Subject, from } from 'rxjs';

import { ResourceProvider } from 'app/graph-viewer/utils/resource/resource-manager';

@Injectable()
export class MapImageProviderService implements ResourceProvider<string, CanvasImageSource> {

  private readonly preloadedUrls = new Map<string, string>();

  constructor() {
  }

  setMemoryImage(id: string, url: string) {
    this.preloadedUrls.set(id, url);
  }

  get(id: string): Observable<CanvasImageSource> {
    const preloadedUrl = this.preloadedUrls.get(id);
    if (preloadedUrl != null) {
      const subject = new Subject<CanvasImageSource>();
      const image = new Image();
      image.onload = () => {
        subject.next(image);
      };
      image.src = preloadedUrl;
      return subject;
    } else {
      // TODO: Return an error to be handled
      return of(null);
    }
  }

  getBlob(id: string): Observable<Blob> {
    const preloadedUrl = this.preloadedUrls.get(id);
    if (preloadedUrl != null) {
      return from(fetch(preloadedUrl).then(r => r.blob()));
    } else {
      // TODO: Return an error to be handled
      return of(null);
    }
  }

}
