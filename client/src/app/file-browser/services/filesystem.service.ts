import { Injectable } from '@angular/core';
import { FilesystemObject, PathLocator } from '../models/filesystem-object';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProjectPageService } from './project-page.service';
import { BehaviorSubject, Observable, Subscription, throwError } from 'rxjs';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { catchError, map } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../shared/services/api.service';
import { ResultList } from '../../shared/schemas/common';
import { ObjectLockData } from '../schema';
import { ObjectLock } from '../models/object-lock';

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

  getLocks(hashId: string): Observable<ObjectLock[]> {
    return this.http.get<ResultList<ObjectLockData>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/locks`, {
        ...this.apiService.getHttpOptions(true),
      },
    ).pipe(
      map(data => {
        return data.results.map(itemData => new ObjectLock().update(itemData));
      }),
    );
  }

  putLock(hashId: string, options: { own: true }): Observable<ObjectLock[]> {
    return this.http.put<ResultList<ObjectLockData>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/locks?own=true`,
      {},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        return data.results.map(itemData => new ObjectLock().update(itemData));
      }),
      catchError(e => {
        if (e instanceof HttpErrorResponse) {
          if (e.status === 409) {
            const otherLocks = e.error.results.map(itemData => new ObjectLock().update(itemData));
            return throwError(new LockError(otherLocks));
          }
        }

        return throwError(e);
      }),
    );
  }

  deleteLock(hashId: string, options: { own: true }): Observable<any> {
    return this.http.delete<unknown>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/locks?own=true`, {
        ...this.apiService.getHttpOptions(true),
      },
    ).pipe(map(() => ({})));
  }
}

export class LockError {
  constructor(public readonly locks: ObjectLock[]) {
  }
}
