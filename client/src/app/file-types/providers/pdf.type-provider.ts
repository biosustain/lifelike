import { Injectable } from '@angular/core';

import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  Exporter,
  PrePublishExporterService,
} from 'app/file-types/providers/base-object.type-provider';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { SearchType } from 'app/search/shared';
import { MimeTypes } from 'app/shared/constants';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';

@Injectable()
export class PdfTypeProvider extends AbstractObjectTypeProvider {
  static readonly defaultExtension = '.pdf';

  constructor(
    protected readonly helper: AbstractObjectTypeProviderHelper,
    protected readonly filesystemService: FilesystemService,
    private readonly prePublishExporter: PrePublishExporterService
  ) {
    super(helper, filesystemService);
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === 'application/pdf';
  }

  getSearchTypes(): SearchType[] {
    return [Object.freeze({ id: MimeTypes.Pdf, shorthand: PDF_SHORTHAND, name: 'Documents' })];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return combineLatest([
      super.getExporters(object),
      this.prePublishExporter.factory(object),
    ]).pipe(
      map(([inheritedExporters, prePublish]) => [
        {
          name: 'PDF',
          export: () => {
            return this.filesystemService.getContent(object.hashId).pipe(
              map((blob) => {
                return new File(
                  [blob],
                  object.filename.endsWith(PdfTypeProvider.defaultExtension) ?
                    object.filename : object.filename + PdfTypeProvider.defaultExtension
                );
              })
            );
          },
        },
        ...prePublish,
        ...inheritedExporters,
      ])
    );
  }
}

export const PDF_SHORTHAND = 'pdf';
