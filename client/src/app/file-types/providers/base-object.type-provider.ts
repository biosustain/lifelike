import { ComponentRef, Injectable, InjectionToken, NgZone } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { has as _has, omit as _omit } from 'lodash/fp';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from 'app/file-browser/components/dialog/object-edit-dialog.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { BulkObjectUpdateRequest, ObjectCreateRequest } from 'app/file-browser/schema';
import { AnnotationsService } from 'app/file-browser/services/annotations.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { CreateDialogOptions } from 'app/file-browser/services/object-creation.service';
import { getObjectLabel } from 'app/file-browser/utils/objects';
import { OrganismAutocomplete } from 'app/interfaces';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { SearchType } from 'app/search/shared';
import { RankedItem } from 'app/shared/schemas/common';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { openModal } from 'app/shared/utils/modals';

export const TYPE_PROVIDER = new InjectionToken<ObjectTypeProvider<any>[]>('objectTypeProvider');

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
export interface ObjectTypeProvider<
  EditDialogResult extends ObjectEditDialogValue = ObjectEditDialogValue
> {
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
  createPreviewComponent(
    object: FilesystemObject,
    contentValue$: Observable<Blob>,
    options?: PreviewOptions
  ): Observable<ComponentRef<any> | undefined>;

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
  openEditDialog(target: FilesystemObject, options?: {}): Promise<EditDialogResult>;

  /**
   * Get a list of search types for the content search.
   */
  getSearchTypes(): SearchType[];

  /**
   * Get a list of ways to export this object.
   */
  getExporters(object: FilesystemObject): Observable<Exporter[]>;

  /**
   * Unzip content (currently only maps).
   */
  unzipContent(zipped: Blob): Observable<string>;
}

/**
 * A collection of methods used by {@link AbstractObjectTypeProvider} separated so
 * that when additional DI dependencies are required, it doesn't require updating
 * all subclasses of {@link AbstractObjectTypeProvider}.
 */
@Injectable()
export class AbstractObjectTypeProviderHelper {
  constructor(
    protected readonly modalService: NgbModal,
    protected readonly annotationsService: AnnotationsService,
    protected readonly filesystemService: FilesystemService,
    protected readonly progressDialog: ProgressDialog,
    protected readonly errorHandler: ErrorHandler,
    protected readonly ngZone: NgZone
  ) {}

  openEditDialog(target: FilesystemObject, options: {} = {}) {
    const dialogRef = openModal(this.modalService, ObjectEditDialogComponent);
    dialogRef.componentInstance.object = target;
    dialogRef.componentInstance.accept = (dialogValue) => {
      const progressDialogRef = this.progressDialog.display({
        title: 'Working...',
        progressObservables: [
          new BehaviorSubject<Progress>(
            new Progress({
              status: `Saving changes to ${getObjectLabel(target)}...`,
            })
          ),
        ],
      });
      return this.filesystemService
        .save([target.hashId], this.parseToPatchRequest(dialogValue), {
          [target.hashId]: target,
        })
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.createFormErrorHandler(dialogRef.componentInstance.form),
          this.errorHandler.create({ label: 'Edit object' }),
          map(() => dialogValue.changes)
        )
        .toPromise();
    };
    return dialogRef.result;
  }

  parseToPatchRequest<I extends ObjectEditDialogValue>({
    changes: { file, annotationConfigs, ...rest },
    value,
  }: I): BulkObjectUpdateRequest {
    const request: BulkObjectUpdateRequest = _omit('parent')(file);
    if (_has('parent.hashId')(file)) {
      request.parentHashId = file.parent.hashId;
    }
    if (annotationConfigs) {
      // If any part of annotationConfigs changes we need to update whole object
      request.annotationConfigs = value.annotationConfigs;
    }
    return {
      ...request,
      ...rest,
    };
  }
}

export interface CreateObjectRequest
  extends Omit<ObjectCreateRequest, 'parentHashId' | 'fallbackOrganism'> {
  parent?: FilesystemObject;
  contexts?: string[];
  fallbackOrganism?: OrganismAutocomplete;
}

/**
 * A base class for object type providers.
 */
export abstract class AbstractObjectTypeProvider<
  T extends ObjectEditDialogValue = ObjectEditDialogValue,
  V extends ObjectEditDialogValue = T
> implements ObjectTypeProvider<V>
{
  abstract handles(object: FilesystemObject): boolean;

  constructor(private readonly helper: AbstractObjectTypeProviderHelper) {}

  createPreviewComponent(
    object: FilesystemObject,
    contentValue$: Observable<Blob>,
    options?: PreviewOptions
  ): Observable<ComponentRef<any> | undefined> {
    return of(null);
  }

  getCreateDialogOptions(options?: CreateDialogOptions) {
    return [];
  }

  parseToRequest(value) {
    return this.helper.parseToRequest(value);
  }

  openEditDialog(target: FilesystemObject, options: {} = {}): Promise<V> {
    return this.helper.openEditDialog(target, options);
  }

  getSearchTypes(): SearchType[] {
    return [];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([]);
  }

  unzipContent(zipped: Blob): Observable<string> {
    return of('');
  }
}
