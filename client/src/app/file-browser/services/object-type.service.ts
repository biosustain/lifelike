import { ComponentRef, Injectable, InjectionToken, Injector } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { Observable, of } from 'rxjs';

export const TYPE_PROVIDER = new InjectionToken<ObjectTypeProvider[]>('objectTypeProvider');

/**
 * A type provider provides services for different file types.
 */
export interface ObjectTypeProvider {

  handles(object: FilesystemObject): boolean;

  createPreviewComponent(object: FilesystemObject): Observable<ComponentRef<any> | undefined>;

}

export class DefaultObjectTypeProvider implements ObjectTypeProvider {

  handles(object: FilesystemObject): boolean {
    return true;
  }

  createPreviewComponent(object: FilesystemObject) {
    return of(null);
  }

}

@Injectable()
export class ObjectTypeService {
  private defaultProvider = new DefaultObjectTypeProvider();

  constructor(protected readonly injector: Injector) {
  }

  get(object: FilesystemObject): Observable<ObjectTypeProvider> {
    const providers = this.injector.get(TYPE_PROVIDER);
    for (const provider of providers) {
      if (provider.handles(object)) {
        return of(provider);
      }
    }
    return of(this.defaultProvider);
  }

}
