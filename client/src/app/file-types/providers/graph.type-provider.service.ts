import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  Exporter,
} from 'app/file-types/providers/base-object.type-provider';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { SearchType } from 'app/search/shared';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { MimeTypes } from 'app/shared/constants';
import { State } from 'app/***ARANGO_USERNAME***-store';

export const GRAPH_SHORTHAND = 'Graph';

@Injectable()
export class GraphTypeProvider extends AbstractObjectTypeProvider {
  constructor(
    abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
    protected readonly filesystemService: FilesystemService,
    store: Store<State>
  ) {
    super(abstractObjectTypeProviderHelper, filesystemService, store);
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.Graph;
  }

  getSearchTypes(): SearchType[] {
    return [Object.freeze({ id: MimeTypes.Graph, shorthand: GRAPH_SHORTHAND, name: 'Graph' })];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return super.getExporters(object).pipe(
      map((inheritedExporters) => [
        {
          name: 'Graph',
          export: () => {
            return this.filesystemService.getContent(object.hashId).pipe(
              map((blob) => {
                return new File(
                  [blob],
                  object.filename.endsWith('.graph') ? object.filename : object.filename + '.graph'
                );
              })
            );
          },
        },
        ...inheritedExporters,
      ])
    );
  }
}
