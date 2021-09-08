import { AbstractObjectTypeProvider, AbstractObjectTypeProviderHelper, Exporter, } from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SearchType } from '../../search/shared';
import { map } from 'rxjs/operators';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { MimeTypes } from '../../shared/constants';

export const SANKEY_SHORTHAND = 'Sankey';

@Injectable()
export class SankeyTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService) {
    super(abstractObjectTypeProviderHelper);
  }


  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.Graph;
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: MimeTypes.Graph, shorthand: SANKEY_SHORTHAND, name: 'Sankey'}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'Sankey',
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
