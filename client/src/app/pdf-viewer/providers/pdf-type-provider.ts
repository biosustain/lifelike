import {
  AbstractObjectTypeProvider,
  PreviewOptions,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { SearchType } from '../../search/shared';
import { ENRICHMENT_TABLE_MIMETYPE } from '../../enrichment-tables/providers/enrichment-table.type-provider';

@Injectable()
export class PdfTypeProvider extends AbstractObjectTypeProvider {

  handles(object: FilesystemObject): boolean {
    return object.mimeType === 'application/pdf';
  }

  createPreviewComponent(object: FilesystemObject, options?: PreviewOptions) {
    // While we COULD return the PDF viewer here, it's too heavyweight
    // to use as a preview
    return of(null);
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: PDF_MIMETYPE, shorthand: PDF_SHORTHAND, name: 'Documents'}),
    ];
  }

}

export const PDF_MIMETYPE = 'application/pdf';
export const PDF_SHORTHAND = 'pdf';
