import { Injectable } from '@angular/core';
import { ResourceProvider } from '../../graph-viewer/utils/resource/resource-manager';
import { Observable, of } from 'rxjs';

@Injectable()
export class MapImageProviderService implements ResourceProvider<string, CanvasImageSource> {

  private readonly memoryImages = new Map<string, CanvasImageSource>();

  constructor() {
  }

  setMemoryImage(id: string, image: CanvasImageSource) {
    this.memoryImages.set(id, image);
  }

  get(id: string): Observable<CanvasImageSource> {
    const memoryImage = this.memoryImages.get(id);
    if (memoryImage != null) {
      return of(memoryImage);
    } else {
      // TODO: Return an error to be handled
      return of(null);
    }
  }

}
