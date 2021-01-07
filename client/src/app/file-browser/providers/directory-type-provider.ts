import {
  AbstractObjectTypeProvider,
  CreateActionOptions,
  CreateDialogAction,
} from '../services/object-type.service';
import { DIRECTORY_MIMETYPE, FilesystemObject } from '../models/filesystem-object';
import { ComponentFactory, ComponentFactoryResolver, Injectable, Injector } from '@angular/core';
import { FilesystemService } from '../services/filesystem.service';
import { map } from 'rxjs/operators';
import { DirectoryPreviewComponent } from '../components/directory-preview.component';
import { RankedItem } from '../../shared/schemas/common';
import { ObjectCreationService } from '../services/object-creation.service';

@Injectable()
export class DirectoryTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly injector: Injector,
              protected readonly filesystemService: FilesystemService,
              protected readonly objectCreationService: ObjectCreationService) {
    super();
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === DIRECTORY_MIMETYPE;
  }

  createPreviewComponent(object: FilesystemObject) {
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
          object.filename = 'New Folder';
          object.mimeType = DIRECTORY_MIMETYPE;
          object.parent = options.parent;
          return this.objectCreationService.openCreateDialog(object, {
            title: 'New Folder',
          });
        },
      },
    }];
  }

}
