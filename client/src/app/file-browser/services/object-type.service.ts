import { ComponentRef, Injectable, InjectionToken, Injector } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { Observable, of } from 'rxjs';
import { RankedItem } from '../../shared/schemas/common';
import { CreateDialogOptions } from './object-creation.service';

export const TYPE_PROVIDER = new InjectionToken<ObjectTypeProvider[]>('objectTypeProvider');

export interface CreateActionOptions {
  parent?: FilesystemObject;
  createDialog?: Omit<CreateDialogOptions, 'request'>;
}

export interface CreateDialogAction {
  /**
   * Whether the object should be opened afterwards.
   */
  openSuggested: boolean;
  /**
   * A description of the object type in Word Case.
   */
  label: string;

  create(options?: CreateActionOptions): Promise<FilesystemObject>;
}

/**
 * A file type provider knows how to handle a certain or set of object types. Instances
 * are used by the application to discover operations on objects stored within Lifelike.
 */
export interface ObjectTypeProvider {

  /**
   * Test whether this provider is for the given type of object.
   * @param object the object
   */
  handles(object: FilesystemObject): boolean;

  /**
   * Create a component to preview the given object, although null can be returned
   * for the observable if the file type cannot be previewed.
   * @param object the object
   */
  createPreviewComponent(object: FilesystemObject): Observable<ComponentRef<any> | undefined>;

  /**
   * Get a list of options for creating this type of file.
   *
   * @return a list of actions, with ranking, where the highest number ranks appear first
   */
  getCreateDialogOptions(): RankedItem<CreateDialogAction>[];

}

/**
 * A base class for object type providers.
 */
export abstract class AbstractObjectTypeProvider implements ObjectTypeProvider {
  abstract handles(object: FilesystemObject): boolean;

  createPreviewComponent(object: FilesystemObject): Observable<ComponentRef<any> | undefined> {
    return of(null);
  }

  getCreateDialogOptions(options?: CreateDialogOptions) {
    return [];
  }

}

/**
 * A generic file type provider that is returned when we don't know what type of object
 * it is or we don't support it.
 */
export class DefaultObjectTypeProvider extends AbstractObjectTypeProvider {

  handles(object: FilesystemObject): boolean {
    return true;
  }

  createPreviewComponent(object: FilesystemObject) {
    return of(null);
  }

}

/**
 * The object type service returns object type providers for given objects.
 */
@Injectable()
export class ObjectTypeService {
  private defaultProvider = new DefaultObjectTypeProvider();

  constructor(protected readonly injector: Injector) {
  }

  /**
   * Get the provider for the given file.
   * @param object the object
   * @return  a provider, which may be the default one
   */
  get(object: FilesystemObject): Observable<ObjectTypeProvider> {
    const providers = this.injector.get(TYPE_PROVIDER);
    for (const provider of providers) {
      if (provider.handles(object)) {
        return of(provider);
      }
    }
    return of(this.defaultProvider);
  }

  /**
   * Load all providers.
   */
  all(): Observable<ObjectTypeProvider[]> {
    return of(this.injector.get(TYPE_PROVIDER));
  }

}
