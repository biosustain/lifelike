import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpResponse,
} from '@angular/common/http';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConnectableObservable, from, Observable, of, throwError } from 'rxjs';
import { catchError, filter, map, publish, refCount, switchMap, tap } from 'rxjs/operators';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { objectToMixedFormData } from 'app/shared/utils/forms';
import { serializePaginatedParams } from 'app/shared/utils/params';
import {
  PaginatedRequestOptions,
  ResultList,
  ResultMapping,
  SingleResult,
} from 'app/shared/schemas/common';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { TrackingService } from 'app/shared/services/tracking.service';
import { TRACKING_ACTIONS, TRACKING_CATEGORIES } from 'app/shared/schemas/tracking';

import { FilesystemObject } from '../models/filesystem-object';
import {
  BulkObjectUpdateRequest,
  FileAnnotationHistoryResponse,
  FileHierarchyResponse,
  FilesystemObjectData,
  HttpObservableResponse,
  ObjectBackupCreateRequest,
  ObjectCreateRequest,
  ObjectExportRequest,
  ObjectLockData,
  ObjectSearchRequest,
  ObjectVersionHistoryResponse,
} from '../schema';
import { ObjectVersion, ObjectVersionHistory } from '../models/object-version';
import { FilesystemObjectList } from '../models/filesystem-object-list';
import { FileAnnotationHistory } from '../models/file-annotation-history';
import { ObjectLock } from '../models/object-lock';
import { RecentFilesService } from './recent-files.service';

/**
 * Endpoints to manage with the filesystem exposed to the user.
 */
@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class FilesystemService {

  constructor(protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly progressDialog: ProgressDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly http: HttpClient,
              protected readonly recentFilesService: RecentFilesService,
              private readonly tracking: TrackingService) {
  }

  // TODO: Type this method
  protected lmdbsDates$ = this.http.get<object>(
    `/api/files/lmdbs_dates`,
  );

  search(options: ObjectSearchRequest): Observable<FilesystemObjectList> {
    return this.http.post<ResultList<FilesystemObjectData>>(
      `/api/filesystem/search`,
      options,
    ).pipe(
      map(data => {
        const list = new FilesystemObjectList();
        list.results.replace(data.results.map(itemData => new FilesystemObject().update(itemData)));
        return list;
      }),
    );
  }

  create(request: ObjectCreateRequest): HttpObservableResponse<SingleResult<FilesystemObject>> {
    const progress$ = this.http.post<SingleResult<FilesystemObjectData>>(
      `/api/filesystem/objects`,
      objectToMixedFormData(request),
      {
        observe: 'events',
        reportProgress: true,
        responseType: 'json',
      },
    ).pipe(
      map(event =>
        event.type === HttpEventType.Response ?
          {
            ...event,
            body: {
              ...event.body,
              result: new FilesystemObject().update(event.body.result)
            },
          } as HttpResponse<SingleResult<FilesystemObject>> :
          event
      ),
      // Wait for connect before emitting
      publish()
    ) as ConnectableObservable<HttpEvent<SingleResult<FilesystemObject>>>;
    return {
      // Progress subscribe is not returning values until we subscribe to body$
      progress$,
      body$: progress$.pipe(
        // Send connect upon subscribe
        refCount(),
        filter(({type}) => type === HttpEventType.Response),
        // Cast to any cause typesript does not understand above filter syntax
        map(response => (response as any).body as SingleResult<FilesystemObject>)
      )
    };
  }

  bulkCreate(data: FormData, transactionId: string): ConnectableObservable<HttpEvent<string>> {
    return this.http.post(
      `/api/filesystem/objects/bulk-upload`,
      data,
      {
        observe: 'events',
        reportProgress: true,
        responseType: 'text',
        headers: {
          'X-Transaction-ID': transactionId
        }
      },
    ) as ConnectableObservable<HttpEvent<string>>;
  }

  /**
   * Access file metadata and record it as file opening action
   * @param hashId - file hash id
   */
  open(
    hashId: string,
  ): Observable<FilesystemObject> {
    return this.get(hashId).pipe(
      tap((file: FilesystemObject) => {
        this.recentFilesService.addToList(file);
        this.tracking.register({
          category: TRACKING_CATEGORIES.filesystem,
          action: TRACKING_ACTIONS.openedFile,
          label: `${file.mimeType} ${file.path}`,
          url: `/file/${file.hashId}`,
        });
      }),
    );
  }

  /**
   * Access file metadata
   * @param hashId - file hash id
   */
  get(hashId: string): Observable<FilesystemObject> {
    return this.http.get<SingleResult<FilesystemObjectData>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}`,
    ).pipe(
      map(data => new FilesystemObject().update(data.result))
    );
  }

  getContent(hashId: string): Observable<Blob> {
    return this.http.get(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/content`, {
        responseType: 'blob',
      },
    );
  }

  /**
   * Gets the 'graph.json' file from the zipped map - without the images. Since the unzipping
   * produces a promise, getting a file and unzipping it in client produces a promise that is
   * dependant on observable - making things harder to process and not aligning with the other file types
   * @param hashId - hashID of a map we want to retrieve
   * @returns Observable of a json file as a Blob.
   * @raises ValidationError - when a file is not a map or file content is corrupted
   */
  getMapContent(hashId: string): Observable<Blob> {
    return this.http.get(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/map-content`, {
        responseType: 'blob',
      }
    );
  }

  // TODO: Deprecate after LL-3006
  getAllEnrichmentTables() {
    return this.http.get<{ result: string[] }>(
      `/api/filesystem/enrichment-tables`, {
        responseType: 'json',
      }
    ).pipe(
      map(data => from(data.result))
    );
  }

  generateExport(hashId: string, request: ObjectExportRequest): Observable<Blob> {
    return this.http.post(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/export`,
      request, {
        responseType: 'blob',
      },
    );
  }

  save(hashIds: string[], changes: Partial<BulkObjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: FilesystemObject }):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.http.patch<ResultMapping<FilesystemObjectData>>(
      `/api/filesystem/objects`, objectToMixedFormData({
        ...changes,
        hashIds
      }),
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: FilesystemObject } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.mapping)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new FilesystemObject();
          }
          ret[itemHashId].update(itemData);
        }
        return ret;
      }),
      tap(ret => this.recentFilesService.updateFileObjects(ret))
    );
  }

  delete(hashIds: string[],
         updateWithLatest?: { [hashId: string]: FilesystemObject }):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.http.request<ResultMapping<FilesystemObjectData>>(
      'DELETE',
      `/api/filesystem/objects`, {
        headers: {'Content-Type': 'application/json'},
        body: {
          hashIds,
        },
        responseType: 'json',
      },
    ).pipe(
      tap(data =>
        hashIds.forEach(hashId => this.recentFilesService.deleteFromList({hashId} as FilesystemObjectData))
      ),
      map(data => {
        const ret: { [hashId: string]: FilesystemObject } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.mapping)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new FilesystemObject();
          }
          ret[itemHashId].update(itemData);
        }
        return ret;
      }),
      tap(ret => this.recentFilesService.updateFileObjects(ret))
    );
  }

  getBackupContent(hashId: string): Observable<Blob | null> {
    return this.http.get(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/backup/content`, {
        responseType: 'blob',
      },
    ).pipe(
      catchError(e => {
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
      }),
    );
  }

  putBackup(request: ObjectBackupCreateRequest): Observable<{}> {
    return this.http.put<{}>(
      `/api/filesystem/objects/${encodeURIComponent(request.hashId)}/backup`,
      objectToMixedFormData(request));
  }

  deleteBackup(hashId: string): Observable<{}> {
    return this.http.delete<{}>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/backup`, {
      },
    );
  }

  getVersionHistory(fileHashId: string,
                    options: PaginatedRequestOptions = {}): Observable<ObjectVersionHistory> {
    return this.http.get<ObjectVersionHistoryResponse>(
      `/api/filesystem/objects/${encodeURIComponent(fileHashId)}/versions`, {
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
        responseType: 'blob',
      },
    );
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
        params: serializePaginatedParams(options, false),
      },
    ).pipe(
      map(data => new FileAnnotationHistory().update(data)),
    );
  }

  annotate(object: FilesystemObject) {
    return this.lmdbsDates$.pipe(
      switchMap(lmdbsDates => object.children.items$.pipe(
        tap(items => {
          items.forEach((child: FilesystemObject) => {
            if (child.type === 'file') {
              const file = child as PdfFile;
              child.annotationsTooltipContent = this.generateTooltipContent(file);
            }
          });
        })
      ))
    );
  }

  private generateTooltipContent(file: PdfFile): string {
    const outdated = Array
      .from(Object.entries(this.lmdbsDates$))
      .filter(([, date]: [string, string]) => Date.parse(date) >= Date.parse(file.annotationsDate));
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
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/locks`
    ).pipe(
      map(data => {
        return data.results.map(itemData => new ObjectLock().update(itemData));
      }),
    );
  }

  // Would `createLock` be a more apt name? "Acquire" implies we're simply fetching a lock, whereas here we create + fetch.
  acquireLock(hashId: string): Observable<ObjectLock[]> {
    return this.http.put<ResultList<ObjectLockData>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/locks?own=true`,
      {},
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

  deleteLock(hashId: string): Observable<{}> {
    return this.http.delete<unknown>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/locks?own=true`
    ).pipe(
      map(() => ({})),
    );
  }

  getHierarchy(directoriesOnly: boolean = false): Observable<FileHierarchyResponse> {
    return this.http.get<FileHierarchyResponse>(
      `/api/filesystem/objects/hierarchy`, {
        params: {
          directoriesOnly: String(directoriesOnly)
        }
      }
    );
  }

  getStarred() {
    return this.http.get<ResultList<FilesystemObjectData>>(`/api/filesystem/objects/starred`).pipe(
      map(data => {
        const list = new FilesystemObjectList();
        list.results.replace(data.results.map(itemData => new FilesystemObject().update(itemData)));
        return list;
      })
    );
  }

  updateStarred(hashId: string, starred: boolean) {
    return this.http.patch<SingleResult<FilesystemObjectData>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/star`,
      { starred }
    ).pipe(map(data => data.result));
  }
}

export class LockError {
  constructor(public readonly locks: ObjectLock[]) {
  }
}

export interface FetchOptions {
  loadContent: boolean;
}
