import {
  AbstractObjectTypeProvider, AbstractObjectTypeProviderHelper,
  CreateActionOptions,
  CreateDialogAction, PreviewOptions,
} from '../services/object-type.service';
import { FilesystemObject } from '../models/filesystem-object';
import {
  ComponentFactory,
  ComponentFactoryResolver,
  Injectable,
  Injector,
  NgZone,
} from '@angular/core';
import { FilesystemService } from '../services/filesystem.service';
import { map } from 'rxjs/operators';
import { DirectoryPreviewComponent } from '../components/directory-preview.component';
import { RankedItem } from 'app/shared/schemas/common';
import { ObjectCreationService } from '../services/object-creation.service';
import { Observable } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AnnotationsService } from '../services/annotations.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

export const DIRECTORY_MIMETYPE = 'vnd.lifelike.filesystem/directory';
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
    return object.mimeType === DIRECTORY_MIMETYPE;
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
