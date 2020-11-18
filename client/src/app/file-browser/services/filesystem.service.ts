import { Injectable } from '@angular/core';
import { FilesystemObject, PathLocator } from '../models/filesystem-object';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProjectPageService } from './project-page.service';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { map } from 'rxjs/operators';
import { FileAnnotationHistory } from '../models/file-annotation-history';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../shared/services/api.service';
import { FileAnnotationHistoryResponse } from '../schema';
import { PaginatedRequestOptions } from '../../interfaces/shared.interface';
import { serializePaginatedParams } from '../../shared/utils/params';

@Injectable()
export class FilesystemService {
  protected lmdbsDates = new BehaviorSubject<object>({});

  constructor(protected readonly filesService: PdfFilesService,
              protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly projectPageService: ProjectPageService,
              protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
    this.filesService.getLMDBsDates().subscribe(lmdbsDates => {
      this.lmdbsDates.next(lmdbsDates);
    });
  }

  get(locator: PathLocator): Observable<FilesystemObject> {
    return this.projectPageService.getDirectory(
      locator.projectName,
      locator.directoryId,
    ).pipe(map(result => {
      const object = new FilesystemObject();
      object.type = 'dir';
      object.locator = {
        projectName: locator.projectName,
        directoryId: result.dir.id + '',
      };
      object.directory = result.dir;
      object.path = result.path;
      object.id = result.dir.id;
      object.name = result.dir.directoryParentId ? result.dir.name : locator.projectName;

      const children = result.objects.map(o => {
        const child = new FilesystemObject();
        Object.assign(child, o);
        if (o.type === 'dir') {
          child.locator = {
            projectName: locator.projectName,
            directoryId: o.id,
          };
        } else {
          child.locator = object.locator;
        }
        child.directory = object.directory;
        child.path = [...result.path, result.dir];
        return child;
      });

      object.children.replace(children);

      return object;
    }));
  }

  /**
   * Get the annotation history for a file.
   * @param hashId the file hash ID
   * @param options additional options
   */
  getAnnotationHistory(hashId: string, options: Partial<PaginatedRequestOptions> = {}):
    Observable<FileAnnotationHistory> {
    return this.http.get<FileAnnotationHistoryResponse>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotation-history`, {
        ...this.apiService.getHttpOptions(true),
        params: serializePaginatedParams(options, false),
      },
    ).pipe(
      map(data => new FileAnnotationHistory().update(data)),
    );
  }

  annotate(object: FilesystemObject): Subscription {
    return this.lmdbsDates.subscribe(data => {
      object.children.items.forEach((child: FilesystemObject) => {
        if (child.type === 'file') {
          const file = child.data as PdfFile;
          child.annotationsTooltipContent = this.generateTooltipContent(file);
        }
      });
    });
  }

  private generateTooltipContent(file: PdfFile): string {
    const outdated = Array
      .from(Object.entries(this.lmdbsDates))
      .filter(([, date]: [string, string]) => Date.parse(date) >= Date.parse(file.annotations_date));
    if (outdated.length === 0) {
      return '';
    }
    return outdated.reduce(
      (tooltip: string, [name, date]: [string, string]) => `${tooltip}\n- ${name}, ${new Date(date).toDateString()}`,
      'Outdated:',
    );
  }
}
