import {
  AbstractObjectTypeProvider,
  CreateActionOptions,
  CreateDialogAction,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { ComponentFactory, ComponentFactoryResolver, Injectable, Injector } from '@angular/core';
import { MapComponent } from '../components/map.component';
import { of } from 'rxjs';
import { RankedItem } from '../../shared/schemas/common';
import { ObjectCreationService } from '../../file-browser/services/object-creation.service';
import { UniversalGraph } from '../services/interfaces';

export const MAP_MIMETYPE = 'vnd.lifelike.document/map';

@Injectable()
export class MapTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly injector: Injector,
              protected readonly objectCreationService: ObjectCreationService) {
    super();
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

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [{
      rank: 100,
      item: {
        label: 'Map',
        openSuggested: true,
        create: (options?: CreateActionOptions) => {
          const object = new FilesystemObject();
          object.filename = 'Untitled Map';
          object.mimeType = MAP_MIMETYPE;
          object.parent = options.parent;
          return this.objectCreationService.openCreateDialog(object, {
            title: 'New Map',
            request: {
              contentValue: new Blob([JSON.stringify({
                edges: [],
                nodes: [],
              } as UniversalGraph)]),
            },
            ...(options.createDialog || {}),
          });
        },
      },
    }];
  }

}
