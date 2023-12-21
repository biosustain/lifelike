import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import {
  AbstractObjectTypeProvider,
  Exporter,
} from 'app/file-types/providers/base-object.type-provider';
import { SearchType } from 'app/search/shared';
import { MimeTypes } from 'app/shared/constants';

export const BIOC_SHORTHAND = 'BioC';

@Injectable()
export class BiocTypeProvider extends AbstractObjectTypeProvider {
  static readonly defaultExtension = '.json';

  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.BioC;
  }

  getSearchTypes(): SearchType[] {
    return [Object.freeze({ id: MimeTypes.BioC, shorthand: BIOC_SHORTHAND, name: BIOC_SHORTHAND })];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return super.getExporters(object).pipe(
      map((inheritedExporters) => [
        {
          name: 'BioC',
          export: () => {
            return this.filesystemService.getContent(object.hashId).pipe(
              map((blob) => {
                return new File(
                  [blob],
                  object.filename.endsWith(BiocTypeProvider.defaultExtension) ?
                    object.filename : object.filename + BiocTypeProvider.defaultExtension
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
