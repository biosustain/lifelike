import { Injectable } from '@angular/core';

import { Observable, of, Subject, from } from 'rxjs';

import { ResourceProvider } from 'app/graph-viewer/utils/resource/resource-manager';

@Injectable()
export class MapImageProviderService implements ResourceProvider<string, CanvasImageSource> {

  private readonly preloadedUrls = new Map<string, string>();

  constructor() {
  }

  setMemoryImage(id: string, file: File): Observable<Dimensions> {
    // this.preloadedUrls.set(id, url);
    let url = URL.createObjectURL(file);
    return new Observable( subscriber => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        let height = img.height;
        let width = img.width;
        if (file.size > 1024 * 1024) {
          height = height / 2.0;
          width = width / 2.0;
          const elem = document.createElement('canvas');
          elem.width = width;
          elem.height = height;
          const ctx = elem.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          url = ctx.canvas.toDataURL(file.type, 0.8);
        }
        this.preloadedUrls.set(id, url);
        subscriber.next({height, width});
       };
     });
  }

  getDimensions(id: string) {
    const preloadedUrl = this.preloadedUrls.get(id);
    if (preloadedUrl != null) {
      return new Observable( subscriber => {
       const img = new Image();
       img.src = preloadedUrl;
       img.onload = () => {
         subscriber.next({height: img.height, width: img.width});
       };
     });
    } else {
      // TODO: Return an error to be handled
      return of(null);
    }
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

export interface Dimensions {
  width: number;
  height: number;
}
