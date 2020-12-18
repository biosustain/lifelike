import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import {
  of, Observable
} from 'rxjs';

import { ANNOTATIONS } from './mock_data';
import { Annotation, AddedAnnotationExclusion } from '../../pdf-viewer/annotation-type';

@Injectable({
  providedIn: 'root'
})
export class PdfAnnotationsService {

  baseUrl = '/api/files';

  constructor(
      private http: HttpClient,
  ) { }

  /**
   * Send sample annotations
   */
  public getMockupAnnotation(): Observable<any[]> {
    return of(ANNOTATIONS);
  }

  /**
   * Retrieves the annotations of the given file.
   * @param fileId id of the file
   */
  getFileAnnotations(fileId: string, projectName: string = 'beta-project'): Observable<any> {
    const url = `/api/projects/${projectName}/files/${fileId}/annotations`;
    return this.http.get(
      url,
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
      { annotation, annotateAll },
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
      { uuid, removeAll },
    );
  }

  /**
   * Excludes automatic annotation from the given file.
   * @param fileId id of the file that contains the annotation
   * @param exclusionData data needed to exclude the annotation
   */
  addAnnotationExclusion(fileId: string, exclusionData: AddedAnnotationExclusion, projectName: string): Observable<any> {
    return this.http.patch(
      `/api/projects/${projectName}/files/${fileId}/annotations/add_annotation_exclusion`,
      exclusionData,
    );
  }

  /**
   * Removes the exclusion mark from the automatic annotation in the given file.
   * @param fileId id of the file that contains the annotation
   * @param type type of the annotation
   * @param text annotated text
   */
  removeAnnotationExclusion(fileId: string, type: string, text: string, projectName: string): Observable<any> {
    return this.http.patch(
      `/api/projects/${projectName}/files/${fileId}/annotations/remove_annotation_exclusion`,
      { type, text },
    );
  }

  /**
   * Search for annoation by id and return annotation object
   * @param annotationId id of the annotation to search for
   */
  public searchForAnnotation(annotationId: string): Annotation {
    return (ANNOTATIONS as Annotation[]).filter(
      (ann: Annotation) => ann.meta.id === annotationId
    )[0] || null;
  }
}
