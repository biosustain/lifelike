import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  Exporter
} from 'app/file-browser/services/object-type.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SearchType } from 'app/search/shared';
import { map } from 'rxjs/operators';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { MimeTypes } from 'app/shared/constants';

export const GRAPH_SHORTHAND = 'Graph';

@Injectable()
export class GraphTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService) {
    super(abstractObjectTypeProviderHelper);
  }


  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.Graph;
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: MimeTypes.Graph, shorthand: GRAPH_SHORTHAND, name: 'Graph'}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'Graph',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename.endsWith('.graph') ? object.filename : object.filename + '.graph');
          }),
        );
      },
    }]);
  }

}
