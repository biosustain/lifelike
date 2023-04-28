import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';

import { Observable } from 'rxjs';
import { filter, map, publish, refCount } from 'rxjs/operators';

import { MimeTypes } from 'app/shared/constants';
import { ResultList, ResultMapping } from 'app/shared/schemas/common';
import { Annotation } from 'app/pdf-viewer/annotation-type';
import {
  SortingAlgorithmId
} from 'app/word-cloud/sorting/sorting-algorithms';

import {
  AnnotationExclusionCreateRequest,
  AnnotationExclusionDeleteRequest,
  PDFAnnotationGenerationRequest,
  AnnotationGenerationResultData,
  CustomAnnotationCreateRequest,
  CustomAnnotationDeleteRequest, HttpObservableResponse,
} from '../schema';

@Injectable()
export class AnnotationsService {
  constructor(protected readonly http: HttpClient) {}

  getAnnotations(hashId: string): Observable<Annotation[]> {
    return this.http.get<ResultList<Annotation>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations`,
    ).pipe(
      map(data => data.results),
    );
  }

  getGeneCounts(hashId: string): Observable<string> {
    return this.http.post<string>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/gene-counts`, {}
    );
  }

  getSortedAnnotations(hashId: string, sort: SortingAlgorithmId) {
    return this.http.post(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/sorted`, {}, {
        params: {sort},
        responseType: 'text',
      },
    );
  }

  generateAnnotations(hashIds: string[], mimeType: string, request: PDFAnnotationGenerationRequest = {}):
    HttpObservableResponse<ResultMapping<AnnotationGenerationResultData>> {
    let requestUrl: string;
    if (mimeType === MimeTypes.Pdf) {
      requestUrl = '/api/filesystem/annotations/generate/pdf';
    } else if (mimeType === MimeTypes.EnrichmentTable) {
      requestUrl = '/api/filesystem/annotations/generate/enrichment-table';
    }
    const progress$ =  this.http.post<ResultMapping<AnnotationGenerationResultData>>(
      requestUrl, {
        hashIds,
        ...request,
      },
      {
        observe: 'events',
        reportProgress: true,
        responseType: 'json',
      },
    ).pipe(
      // Wait for connect before emitting
      publish()
    );
    return {
      // Progress subscribe is not returning values until we subscribe to body$
      progress$,
      body$: progress$.pipe(
        // Send connect upon subscribe
        refCount(),
        filter(({type}) => type === HttpEventType.Response),
        // Cast to any cause typesript does not understand above filter syntax
        map(response => (response as any).body as ResultMapping<AnnotationGenerationResultData>)
      )
    };
  }

  addCustomAnnotation(hashId: string, request: CustomAnnotationCreateRequest): Observable<Annotation[]> {
    return this.http.post<ResultList<Annotation>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/custom`,
      request,
    ).pipe(
      map(data => data.results),
    );
  }

  removeCustomAnnotation(hashId: string, uuid: string, request: CustomAnnotationDeleteRequest): Observable<string[]> {
    return this.http.request<ResultList<string>>(
      'DELETE',
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/custom/${encodeURIComponent(uuid)}`, {
        headers: {'Content-Type': 'application/json'},
        body: request,
        responseType: 'json',
      },
    ).pipe(
      map(data => data.results),
    );
  }

  addAnnotationExclusion(hashId: string, request: AnnotationExclusionCreateRequest): Observable<{}> {
    return this.http.post<{}>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/exclusions`,
      request,
    ).pipe(
      map(() => ({}))
    );
  }

  removeAnnotationExclusion(hashId: string, request: AnnotationExclusionDeleteRequest): Observable<{}> {
    return this.http.request<{}>(
      'DELETE',
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/exclusions`, {
        headers: {'Content-Type': 'application/json'},
        body: request,
        responseType: 'json',
      },
    ).pipe(
      map(() => ({}))
    );
  }

}
