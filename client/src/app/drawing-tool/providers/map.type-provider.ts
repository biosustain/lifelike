import {
  AbstractObjectTypeProvider,
  CreateActionOptions,
  CreateDialogAction,
  Exporter,
  PreviewOptions,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { ComponentFactory, ComponentFactoryResolver, Injectable, Injector } from '@angular/core';
import { MapComponent } from '../components/map.component';
import { Observable, of } from 'rxjs';
import { RankedItem } from '../../shared/schemas/common';
import { ObjectCreationService } from '../../file-browser/services/object-creation.service';
import { UniversalGraph } from '../services/interfaces';
import { SearchType } from '../../search/shared';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { map } from 'rxjs/operators';

export const MAP_MIMETYPE = 'vnd.lifelike.document/map';

@Injectable()
export class MapTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly injector: Injector,
              protected readonly objectCreationService: ObjectCreationService,
              protected readonly filesystemService: FilesystemService) {
    super();
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === MAP_MIMETYPE;
  }

  createPreviewComponent(object: FilesystemObject, contentValue$: Observable<Blob>,
                         options?: PreviewOptions) {
    return contentValue$.pipe(
      map(contentValue => {
        const factory: ComponentFactory<MapComponent<any>> =
          this.componentFactoryResolver.resolveComponentFactory(MapComponent);
        const componentRef = factory.create(this.injector);
        const instance: MapComponent = componentRef.instance;
        instance.highlightTerms = options ? options.highlightTerms : null;
        instance.map = object;
        instance.contentValue = contentValue;
        return componentRef;
      }),
    );
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

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: MAP_MIMETYPE, name: 'Maps'}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([...(
      ['pdf', 'png', 'svg'].map(format => ({
        name: format.toUpperCase(),
        export: () => {
          return this.filesystemService.generateExport(object.hashId, {format}).pipe(
            map(blob => {
              return new File([blob], object.filename + '.' + format);
            }),
          );
        },
      }))
    ), {
      name: 'Lifelike Map File',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename + '.llmap.json');
          }),
        );
      },
    }]);
  }

}
