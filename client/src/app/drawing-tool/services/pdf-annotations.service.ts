import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, of } from 'rxjs';

import { ANNOTATIONS } from './mock_data';
import { AddedAnnotationExclusion, Annotation } from '../../pdf-viewer/annotation-type';
import { ApiService } from '../../shared/services/api.service';
import { AnnotationGenerationRequest, ObjectAnnotationsDataResponse, MultipleAnnotationGenerationResponse } from '../../file-browser/schema';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PdfAnnotationsService {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  /**
   * Send sample annotations
   */
  public getMockupAnnotation(): Observable<any[]> {
    return of(ANNOTATIONS);
  }

  getAnnotations(hashId: string): Observable<Annotation[]> {
    return this.http.get<ObjectAnnotationsDataResponse>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => data.annotations),
    );
  }

  generateAnnotations(hashIds: string[],
                      request: AnnotationGenerationRequest = {}):
    Observable<MultipleAnnotationGenerationResponse> {
    return this.http.post<MultipleAnnotationGenerationResponse>(
      `/api/filesystem/annotations/generate`, {
        hashIds,
        ...request,
      },
      this.apiService.getHttpOptions(true),
    );
  }

  /**
   * Adds custom annotation for the given file.
   * @param fileId id of the file
   * @param annotation annotation to add
   * @param annotateAll indicates if the rest of the document should be annotated
   */
  addCustomAnnotation(fileId: string, annotation: Annotation, annotateAll: boolean, projectName: string = 'beta-project'): Observable<any> {
    const url = `/api/projects/${projectName}/files/${fileId}/annotations/add`;
    return this.http.patch(
      url,
      {annotation, annotateAll},
      this.apiService.getHttpOptions(true),
    );
  }

  /**
   * Deletes custom annotation from the given file.
   * @param fileId id of the file that contains the annotation
   * @param uuid uuid of the annotation to be deleted
   * @param removeAll indicates if all the matching annotations should be removed
   */
  removeCustomAnnotation(fileId: string, uuid: string, removeAll: boolean, projectName: string = 'beta-project'): Observable<any> {
    const url = `/api/projects/${projectName}/files/${fileId}/annotations/remove`;
    return this.http.patch(
      url,
      {uuid, removeAll},
      this.apiService.getHttpOptions(true),
    );
  }

  /**
   * Excludes automatic annotation from the given file.
   * @param fileId id of the file that contains the annotation
   * @param exclusionData data needed to exclude the annotation
   */
  addAnnotationExclusion(fileId: string, exclusionData: AddedAnnotationExclusion, projectName: string = ''): Observable<any> {
    return this.http.patch(
      `/api/projects/${projectName}/files/${fileId}/annotations/add_annotation_exclusion`,
      exclusionData,
      this.apiService.getHttpOptions(true),
    );
  }

  /**
   * Removes the exclusion mark from the automatic annotation in the given file.
   * @param fileId id of the file that contains the annotation
   * @param type type of the annotation
   * @param text annotated text
   */
  removeAnnotationExclusion(fileId: string, type: string, text: string, projectName: string = ''): Observable<any> {
    return this.http.patch(
      `/api/projects/${projectName}/files/${fileId}/annotations/remove_annotation_exclusion`,
      {type, text},
      this.apiService.getHttpOptions(true),
    );
  }

  /**
   * Search for annoation by id and return annotation object
   * @param annotationId id of the annotation to search for
   */
  public searchForAnnotation(annotationId: string): Annotation {
    return (ANNOTATIONS as Annotation[]).filter(
      (ann: Annotation) => ann.meta.id === annotationId,
    )[0] || null;
  }
}
