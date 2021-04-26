import {
  AbstractObjectTypeProvider, AbstractObjectTypeProviderHelper,
  Exporter,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SearchType } from '../../search/shared';
import { map } from 'rxjs/operators';
import { FilesystemService } from '../../file-browser/services/filesystem.service';


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
      Object.freeze({id: BIOC_MIMETYPE, shorthand: BIOC_SHORTHAND, name: 'Documents'}),
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
