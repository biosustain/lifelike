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


export const GRAPH_MIMETYPE = 'vnd.***ARANGO_DB_NAME***.document/graph';
export const GRAPH_SHORTHAND = 'Graph';

@Injectable()
export class GraphTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService) {
    super(abstractObjectTypeProviderHelper);
  }


  handles(object: FilesystemObject): boolean {
    return object.mimeType === GRAPH_MIMETYPE;
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: GRAPH_MIMETYPE, shorthand: GRAPH_SHORTHAND, name: 'Graph'}),
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
