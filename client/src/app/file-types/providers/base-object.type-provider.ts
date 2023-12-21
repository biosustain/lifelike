import { ComponentRef, Injectable, InjectionToken, NgZone } from '@angular/core';

import { BehaviorSubject, Observable, of } from 'rxjs';
import { finalize, map } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { CreateDialogOptions } from 'app/file-browser/services/object-creation.service';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from 'app/file-browser/components/dialog/object-edit-dialog.component';
import { getObjectLabel } from 'app/file-browser/utils/objects';
import { AnnotationsService } from 'app/file-browser/services/annotations.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { RankedItem } from 'app/shared/schemas/common';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { openModal } from 'app/shared/utils/modals';
import { SearchType } from 'app/search/shared';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { AuthenticationService } from 'app/auth/services/authentication.service';

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
  isPrePublish?: boolean;

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
  openEditDialog(target: FilesystemObject, options?: {}): Promise<ObjectEditDialogValue>;

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

  openEditDialog(target: FilesystemObject, options: {} = {}): Promise<ObjectEditDialogValue> {
    const dialogRef = openModal(this.modalService, ObjectEditDialogComponent);
    dialogRef.componentInstance.object = target;
    dialogRef.componentInstance.accept = (value: ObjectEditDialogValue) => {
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
        .save([target.hashId], value.patchRequest, {
          [target.hashId]: target,
        })
        .pipe(
          map(() => value),
          finalize(() => progressDialogRef.close()),
          this.errorHandler.createFormErrorHandler(dialogRef.componentInstance.form),
          this.errorHandler.create({ label: 'Edit object' })
        )
        .toPromise();
    };
    return dialogRef.result;
  }
}

@Injectable()
export class PrePublishExporterService {
  constructor(
    protected readonly filesystemService: FilesystemService,
    private readonly authService: AuthenticationService
  ) {}

  factory(object: FilesystemObject): Observable<Exporter[]> {
    return of([
      {
        name: 'Zip',
        isPrePublish: true,
        export: () =>
          this.filesystemService.generatePrePublish(object.hashId, {
            format: 'zip',
            exportLinked: true,
          }),
      },
    ]);
  }
}

/**
 * A base class for object type providers.
 */
@Injectable()
export abstract class AbstractObjectTypeProvider implements ObjectTypeProvider {
  constructor(
    protected readonly helper: AbstractObjectTypeProviderHelper,
    protected readonly filesystemService: FilesystemService // private readonly prePublishExporter: PrePublishExporterService
  ) {}

  abstract handles(object: FilesystemObject): boolean;

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

  openEditDialog(target: FilesystemObject, options: {} = {}): Promise<ObjectEditDialogValue> {
    return this.helper.openEditDialog(target, options);
  }

  getSearchTypes(): SearchType[] {
    return [];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    // LL-5375: limiting publishing options so it is rollable
    // return this.prePublishExporter.factory(object);
    // LL-5387: partly reintroduce features
    return of([
      {
        name: 'Zip',
        export: () =>
          this.filesystemService.generateExport(object.hashId, {
            format: 'zip',
            exportLinked: true,
          }),
      },
    ]);
  }

  unzipContent(zipped: Blob): Observable<string> {
    return of('');
  }
}
