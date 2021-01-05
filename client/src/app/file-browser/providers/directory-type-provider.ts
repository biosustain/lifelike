import {ObjectTypeProvider} from '../services/object-type.service';
import {DIRECTORY_MIMETYPE, FilesystemObject} from '../models/filesystem-object';
import {ComponentFactory, ComponentFactoryResolver, Injectable, Injector} from '@angular/core';
import {FilesystemService} from '../services/filesystem.service';
import {map} from 'rxjs/operators';
import {DirectoryPreviewComponent} from '../components/directory-preview.component';

@Injectable()
export class DirectoryTypeProvider implements ObjectTypeProvider {

  constructor(protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly injector: Injector,
              protected readonly filesystemService: FilesystemService) {
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

}
