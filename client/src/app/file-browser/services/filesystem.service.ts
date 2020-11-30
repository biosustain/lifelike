import { Injectable } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProjectPageService } from './project-page.service';
import { BehaviorSubject, Observable, of, Subscription, throwError } from 'rxjs';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { ApiService } from '../../shared/services/api.service';
import {
  BulkObjectUpdateRequest,
  FilesystemObjectData,
  MultipleObjectDataResponse,
  ObjectBackupCreateRequest,
  ObjectCreateRequest,
  ObjectDataResponse,
  ObjectExportRequest,
  ObjectSearchRequest,
  ObjectVersionHistoryResponse,
} from '../schema';
import { objectToFormData, objectToMixedFormData } from '../../shared/utils/forms';
import { PaginatedRequestOptions, ResultList } from '../../interfaces/shared.interface';
import { ObjectVersion, ObjectVersionHistory } from '../models/object-version';
import { serializePaginatedParams } from '../../shared/utils/params';
import { FilesystemObjectList } from '../models/filesystem-object-list';

/**
 * Endpoints to manage with the filesystem exposed to the user.
 */
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

  search(options: ObjectSearchRequest): Observable<FilesystemObjectList> {
    return this.http.post<ResultList<FilesystemObjectData>>(
      `/api/filesystem/search`,
      options,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const list = new FilesystemObjectList();
        list.results.replace(data.results.map(itemData => new FilesystemObject().update(itemData)));
        return list;
      }),
    );
  }

  put(request: ObjectCreateRequest): Observable<HttpEvent<any> & {
    bodyValue?: FilesystemObject,
  }> {
    return this.http.post(
      `/api/filesystem/objects`,
      objectToFormData(request), {
        ...this.apiService.getHttpOptions(true),
        observe: 'events',
        reportProgress: true,
        responseType: 'json',
      },
    ).pipe(
      map(event => {
        if (event.type === HttpEventType.Response) {
          const body: ObjectDataResponse = event.body as ObjectDataResponse;
          (event as any).bodyValue = new FilesystemObject().update(body.object);
        }
        return event;
      }),
    );
  }

  get(hashId: string, options: Partial<FetchOptions> = {}): Observable<FilesystemObject> {
    let result: Observable<FilesystemObject> = this.http.get<ObjectDataResponse>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => new FilesystemObject().update(data.object)),
    );

    // Load content via a separate endpoint if requested
    if (options.loadContent) {
      result = result.pipe(
        mergeMap(object => this.getContent(object.hashId).pipe(map(contentValue => {
          object.contentValue = contentValue;
          return object;
        }))),
      );
    }

    return result;
  }

  getContent(hashId: string): Observable<Blob> {
    return this.http.get(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/content`, {
        ...this.apiService.getHttpOptions(true),
        responseType: 'blob',
      },
    );
  }

  generateExport(hashId: string, request: ObjectExportRequest): Observable<Blob> {
    return this.http.post(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/export`,
      request, {
        ...this.apiService.getHttpOptions(true),
        responseType: 'blob',
      },
    );
  }

  save(hashIds: string[], changes: Partial<BulkObjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: FilesystemObject }):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.http.patch<MultipleObjectDataResponse>(
      `/api/filesystem/objects`, objectToMixedFormData({
        ...changes,
        hashIds,
      }), this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: FilesystemObject } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.objects)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new FilesystemObject();
          }
          ret[itemHashId].update(itemData);
        }
        return ret;
      }),
    );
  }

  delete(hashIds: string[],
         updateWithLatest?: { [hashId: string]: FilesystemObject }):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.http.request<MultipleObjectDataResponse>(
      'DELETE',
      `/api/filesystem/objects`, {
        ...this.apiService.getHttpOptions(true, {
          contentType: 'application/json',
        }),
        body: {
          hashIds,
        },
        responseType: 'json',
      },
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: FilesystemObject } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.objects)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new FilesystemObject();
          }
          ret[itemHashId].update(itemData);
        }
        return ret;
      }),
    );
  }

  getBackupContent(hashId: string): Observable<Blob | null> {
    return this.http.get(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/backup/content`, {
        ...this.apiService.getHttpOptions(true),
        responseType: 'blob',
      },
    ).pipe(catchError(e => {
      // If the backup doesn't exist, don't let the caller have to figure out
      // that it's a HTTP error and then check the status!
      // Let's return a null indicating that there's no backup
      if (e instanceof HttpErrorResponse) {
        if (e.status === 404) {
          return of(null);
        }
      }

      // If it's any other type of error, we need to propagate it so
      // the calling code can handle it through its normal error handling
      return throwError(e);
    }));
  }

  putBackup(request: ObjectBackupCreateRequest): Observable<any> {
    return this.http.put<unknown>(
      `/api/filesystem/objects/${encodeURIComponent(request.hashId)}/backup`,
      objectToMixedFormData(request),
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(() => ({})),
    );
  }

  deleteBackup(hashId: string): Observable<any> {
    return this.http.delete<unknown>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/backup`, {
        ...this.apiService.getHttpOptions(true),
      },
    ).pipe(map(() => ({})));
  }

  getVersionHistory(fileHashId: string,
                    options: PaginatedRequestOptions = {}): Observable<ObjectVersionHistory> {
    return this.http.get<ObjectVersionHistoryResponse>(
      `/api/filesystem/objects/${encodeURIComponent(fileHashId)}/versions`, {
        ...this.apiService.getHttpOptions(true),
        params: serializePaginatedParams(options, false),
      },
    ).pipe(
      map(data => {
        const object = new FilesystemObject().update(data.object);
        const list = new ObjectVersionHistory();
        list.results.replace(data.results.map(itemData => {
          const version = new ObjectVersion();
          version.originalObject = object;
          version.update(itemData);
          return version;
        }));
        return list;
      }),
    );
  }

  getVersionContent(hashId: string): Observable<Blob> {
    return this.http.get(
      `/api/filesystem/versions/${encodeURIComponent(hashId)}/content`, {
        ...this.apiService.getHttpOptions(true),
        responseType: 'blob',
      },
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

export interface FetchOptions {
  loadContent: boolean;
}
