import { Injectable } from '@angular/core';
import { FilesystemObject, PathLocator, ProjectImpl } from '../models/filesystem-object';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProjectPageService } from './project-page.service';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../shared/services/api.service';
import { ResultList } from '../../interfaces/shared.interface';
import { ProjectList } from '../models/project-list';

@Injectable()
export class FilesystemService {
  protected lmdbsDates = new BehaviorSubject<object>({});

  constructor(protected readonly filesService: PdfFilesService,
              protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly progressDialog: ProgressDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly projectPageService: ProjectPageService,
              protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
    this.filesService.getLMDBsDates().subscribe(lmdbsDates => {
      this.lmdbsDates.next(lmdbsDates);
    });
  }

  get(hashId: string): Observable<FilesystemObject> {
    return this.http.get<{object: FilesystemObjectData}>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}`, this.apiService.getHttpOptions(true)
    ).pipe(
      map(data => new FilesystemObject().update(data.object))
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
