import {
  AbstractObjectTypeProvider,
  Exporter,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SearchType } from '../../search/shared';
import { map } from 'rxjs/operators';
import { FilesystemService } from '../../file-browser/services/filesystem.service';

@Injectable()
export class PdfTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly filesystemService: FilesystemService) {
    super();
  }


  handles(object: FilesystemObject): boolean {
    return object.mimeType === 'application/pdf';
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: PDF_MIMETYPE, name: 'Documents'}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'PDF',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename.endsWith('.pdf') ? object.filename : object.filename + '.pdf');
          }),
        );
      },
    }]);
  }

}

export const PDF_MIMETYPE = 'application/pdf';
