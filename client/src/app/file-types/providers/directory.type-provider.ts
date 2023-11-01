import { ComponentFactory, ComponentFactoryResolver, Injectable, Injector } from '@angular/core';

import { map, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { select, Store } from '@ngrx/store';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { DirectoryPreviewComponent } from 'app/file-browser/components/directory-preview.component';
import { ObjectCreationService } from 'app/file-browser/services/object-creation.service';
import { RankedItem } from 'app/shared/schemas/common';
import { MimeTypes } from 'app/shared/constants';
import { AuthSelectors } from 'app/auth/store';
import { State } from 'app/root-store';

import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  CreateActionOptions,
  CreateDialogAction,
  Exporter,
  PreviewOptions,
} from './base-object.type-provider';

export const DIRECTORY_SHORTHAND = 'directory';

@Injectable()
export class DirectoryTypeProvider extends AbstractObjectTypeProvider {
  constructor(
    abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
    protected readonly filesystemService: FilesystemService,
    protected readonly injector: Injector,
    protected readonly objectCreationService: ObjectCreationService,
    protected readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly store: Store<State>
  ) {
    super(abstractObjectTypeProviderHelper);
  }

  isAdmin$ = this.store.pipe(
    select(AuthSelectors.selectRoles),
    map((roles) => roles.includes('admin'))
  );

  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.Directory;
  }

  createPreviewComponent(
    object: FilesystemObject,
    contentValue$: Observable<Blob>,
    options?: PreviewOptions
  ) {
    return this.filesystemService.get(object.hashId).pipe(
      map((newObject) => {
        const factory: ComponentFactory<DirectoryPreviewComponent> =
          this.componentFactoryResolver.resolveComponentFactory(DirectoryPreviewComponent);
        const componentRef = factory.create(this.injector);
        const instance: DirectoryPreviewComponent = componentRef.instance;
        instance.objects = newObject.children;
        return componentRef;
      })
    );
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [
      {
        rank: 100,
        item: {
          label: 'Folder',
          openSuggested: false,
          create: (options?: CreateActionOptions) => {
            const object = new FilesystemObject();
            object.filename = '';
            object.mimeType = MimeTypes.Directory;
            object.parent = options.parent;
            return this.objectCreationService.openCreateDialog(object, {
              title: 'New Folder',
            });
          },
        },
      },
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return super.getExporters(object).pipe(
      switchMap((exporters) =>
        this.isAdmin$.pipe(
          map((isAdmin) =>
            isAdmin
              ? [
                  ...exporters,
                  {
                    name: 'Zip',
                    export: () =>
                      this.filesystemService
                        .generateExport(object.hashId, { format: 'zip', exportLinked: true })
                        .pipe(map((blob) => new File([blob], object.filename + '.zip'))),
                  },
                ]
              : exporters
          )
        )
      )
    );
  }
}
