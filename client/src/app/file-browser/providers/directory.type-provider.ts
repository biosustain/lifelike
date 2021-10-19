import {
  ComponentFactory,
  ComponentFactoryResolver,
  Injectable,
  Injector,
} from '@angular/core';

import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

import { RankedItem } from 'app/shared/schemas/common';
import { MimeTypes } from 'app/shared/constants';

import {
  AbstractObjectTypeProvider, AbstractObjectTypeProviderHelper,
  CreateActionOptions,
  CreateDialogAction, PreviewOptions,
} from '../services/object-type.service';
import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from '../services/filesystem.service';
import { DirectoryPreviewComponent } from '../components/directory-preview.component';
import { ObjectCreationService } from '../services/object-creation.service';

export const DIRECTORY_SHORTHAND = 'directory';

@Injectable()
export class DirectoryTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService,
              protected readonly injector: Injector,
              protected readonly objectCreationService: ObjectCreationService,
              protected readonly componentFactoryResolver: ComponentFactoryResolver) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.Directory;
  }

  createPreviewComponent(object: FilesystemObject, contentValue$: Observable<Blob>,
                         options?: PreviewOptions) {
    return this.filesystemService.get(object.hashId).pipe(map(newObject => {
      const factory: ComponentFactory<DirectoryPreviewComponent> =
        this.componentFactoryResolver.resolveComponentFactory(DirectoryPreviewComponent);
      const componentRef = factory.create(this.injector);
      const instance: DirectoryPreviewComponent = componentRef.instance;
      instance.objects = newObject.children;
      return componentRef;
    }));
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [{
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
    }];
  }

}
