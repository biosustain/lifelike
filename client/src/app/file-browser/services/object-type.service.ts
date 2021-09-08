import { ComponentRef, Injectable, InjectionToken, Injector, NgZone } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { RankedItem } from 'app/shared/schemas/common';
import { CreateDialogOptions } from './object-creation.service';
import { SearchType } from '../../search/shared';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from '../components/dialog/object-edit-dialog.component';
import { getObjectLabel } from '../utils/objects';
import { finalize, map } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AnnotationsService } from './annotations.service';
import { FilesystemService } from './filesystem.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { openModal } from 'app/shared/utils/modals';

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

export interface PreviewOptions {
  highlightTerms?: string[] | undefined;
}

export interface Exporter {
  name: string;

  export(linkedExport?: boolean): Observable<File>;
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
   * @param contentValue$ the content to use
   * @param options extra options for the preview
   */
  createPreviewComponent(object: FilesystemObject, contentValue$: Observable<Blob>,
                         options?: PreviewOptions): Observable<ComponentRef<any> | undefined>;

  /**
   * Get a list of options for creating this type of file.
   *
   * @return a list of actions, with ranking, where the highest number ranks appear first
   */
  getCreateDialogOptions(): RankedItem<CreateDialogAction>[];

  /**
   * Open the edit dialog for the provided object.
   *
   * @param target the object
   * @param options options for the dialog
   * @return a promise that resolves after edit or fails if editing is cancelled
   */
  openEditDialog(target: FilesystemObject, options?: {}): Promise<any>;

  /**
   * Get a list of search types for the content search.
   */
  getSearchTypes(): SearchType[];

  /**
   * Get a list of ways to export this object.
   */
  getExporters(object: FilesystemObject): Observable<Exporter[]>;

}

/**
 * A collection of methods used by {@link AbstractObjectTypeProvider} separated so
 * that when additional DI dependencies are required, it doesn't require updating
 * all subclasses of {@link AbstractObjectTypeProvider}.
 */
@Injectable()
export class AbstractObjectTypeProviderHelper {
  constructor(protected readonly modalService: NgbModal,
              protected readonly annotationsService: AnnotationsService,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly ngZone: NgZone) {
  }

  openEditDialog(target: FilesystemObject, options: {} = {}): Promise<any> {
    const dialogRef = openModal(this.modalService, ObjectEditDialogComponent);
    dialogRef.componentInstance.object = target;
    dialogRef.componentInstance.accept = ((value: ObjectEditDialogValue) => {
      const progressObservable = new BehaviorSubject<Progress>(new Progress({
        status: `Saving changes to ${getObjectLabel(target)}...`,
      }));
      const progressDialogRef = this.progressDialog.display({
        title: 'Working...',
        progressObservable,
      });
      return this.filesystemService.save([target.hashId], value.request, {
        [target.hashId]: target,
      })
        .pipe(
          map(() => value),
          finalize(() => progressDialogRef.close()),
          this.errorHandler.createFormErrorHandler(dialogRef.componentInstance.form),
          this.errorHandler.create({label: 'Edit object'}),
        )
        .toPromise();
    });
    return dialogRef.result;
  }
}

/**
 * A base class for object type providers.
 */
export abstract class AbstractObjectTypeProvider implements ObjectTypeProvider {
  abstract handles(object: FilesystemObject): boolean;

  constructor(private readonly helper: AbstractObjectTypeProviderHelper) {
  }

  createPreviewComponent(object: FilesystemObject, contentValue$: Observable<Blob>,
                         options?: PreviewOptions): Observable<ComponentRef<any> | undefined> {
    return of(null);
  }

  getCreateDialogOptions(options?: CreateDialogOptions) {
    return [];
  }

  openEditDialog(target: FilesystemObject, options: {} = {}): Promise<any> {
    return this.helper.openEditDialog(target, options);
  }

  getSearchTypes(): SearchType[] {
    return [];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([]);
  }

}

/**
 * A generic file type provider that is returned when we don't know what type of object
 * it is or we don't support it.
 */
@Injectable()
export class DefaultObjectTypeProvider extends AbstractObjectTypeProvider {
  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    return true;
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'Download',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename);
          }),
        );
      },
    }]);
  }
}

/**
 * The object type service returns object type providers for given objects.
 */
@Injectable()
export class ObjectTypeService {
  constructor(protected readonly injector: Injector,
              private readonly defaultProvider: DefaultObjectTypeProvider) {
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

  getDefault(): Observable<ObjectTypeProvider> {
    return of(this.defaultProvider);
  }
}
