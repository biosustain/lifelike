import { Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  Exporter,
} from 'app/file-browser/services/object-type.service';
import { SearchType } from 'app/search/shared';



export const BIOC_MIMETYPE = 'vnd.lifelike.document/bioc';
export const BIOC_SHORTHAND = 'BioC';

@Injectable()
export class BiocTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService) {
    super(abstractObjectTypeProviderHelper);
  }


  handles(object: FilesystemObject): boolean {
    return object.mimeType === BIOC_MIMETYPE;
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: BIOC_MIMETYPE, shorthand: BIOC_SHORTHAND, name: BIOC_SHORTHAND}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'BioC',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename.endsWith('.json') ? object.filename : object.filename + '.json');
          }),
        );
      },
    }]);
  }

}
