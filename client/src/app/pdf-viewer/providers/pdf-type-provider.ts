import { AbstractObjectTypeProvider } from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { of } from 'rxjs';

@Injectable()
export class PdfTypeProvider extends AbstractObjectTypeProvider {

  handles(object: FilesystemObject): boolean {
    return object.mimeType === 'application/pdf';
  }

  createPreviewComponent(object: FilesystemObject) {
    // While we COULD return the PDF viewer here, it's too heavyweight
    // to use as a preview
    return of(null);
  }

}
