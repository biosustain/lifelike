import { ObjectTypeProvider } from '../../file-browser/services/object-type.service';
import { FilesystemObject, MAP_MIMETYPE } from '../../file-browser/models/filesystem-object';
import { ComponentFactory, ComponentFactoryResolver, ComponentRef, Injectable, Injector } from '@angular/core';
import { MapComponent } from '../components/map.component';
import { of } from 'rxjs';

@Injectable()
export class MapTypeProvider implements ObjectTypeProvider {

  constructor(protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly injector: Injector) {
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === MAP_MIMETYPE;
  }

  createPreviewComponent(object: FilesystemObject) {
    const factory: ComponentFactory<MapComponent<any>> =
      this.componentFactoryResolver.resolveComponentFactory(MapComponent);
    const componentRef = factory.create(this.injector);
    const instance: MapComponent = componentRef.instance;
    instance.locator = object.hashId;
    return of(componentRef);
  }

}
