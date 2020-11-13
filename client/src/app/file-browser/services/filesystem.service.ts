import { Injectable } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProjectPageService } from './project-page.service';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { map, mergeMap } from 'rxjs/operators';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { ApiService } from '../../shared/services/api.service';
import { RecursivePartial } from '../../shared/utils/types';
import { BulkFileUpdateRequest, FileCreateRequest, FileDataResponse, MultipleFileDataResponse } from '../schema';
import { objectToFormData, objectToMixedFormData } from '../../shared/utils/forms';

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

  put(request: RecursivePartial<FileCreateRequest>): Observable<HttpEvent<object> & {
    bodyValue?: FilesystemObject,
  }> {
    return this.http.put(
      `/api/filesystem/objects`,
      objectToMixedFormData(request), {
        ...this.apiService.getHttpOptions(true),
        observe: 'events',
        reportProgress: true,
        responseType: 'json',
      },
    ).pipe(
      map(event => {
        if (event.type === HttpEventType.Response) {
          (event as any).bodyValue = new FilesystemObject().update(event.body);
        }
        return event;
      }),
    );
  }

  get(hashId: string, options: Partial<FetchOptions> = {}): Observable<FilesystemObject> {
    let result: Observable<FilesystemObject> = this.http.get<FileDataResponse>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => new FilesystemObject().update(data.object)),
    );

    // Load content via a separate endpoint if requested
    if (options.loadContent) {
      result = result.pipe(
        mergeMap(object => this.getContent(object.hashId).pipe(map(contentValue => {
          object.contentValue = new Blob([contentValue], {
            type: object.mimeType,
          });
          return object;
        }))),
      );
    }

    return result;
  }

  getContent(hashId: string): Observable<ArrayBuffer> {
    return this.http.get(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/content`, {
        ...this.apiService.getHttpOptions(true),
        responseType: 'arraybuffer',
      },
    );
  }

  save(hashIds: string[], changes: Partial<BulkFileUpdateRequest>,
       updateWithLatest?: { [hashId: string]: FilesystemObject }):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.http.patch<MultipleFileDataResponse>(
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
    return this.http.request<MultipleFileDataResponse>(
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
