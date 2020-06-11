import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import {
  of, Observable
} from 'rxjs';

import { ANNOTATIONS } from './mock_data';
import {
  Annotation
} from './interfaces';

@Injectable({
  providedIn: 'root'
})
export class PdfAnnotationsService {

  baseUrl = '/api/files';

  constructor(
      private http: HttpClient,
  ) { }

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param withJwt boolean representing whether to return the options with a jwt
   */
  createHttpOptions(withJwt = false) {
    if (withJwt) {
      return {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('access_jwt'),
        }),
      };
    } else {
      return {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
      };
    }
  }

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
  getFileAnnotations(fileId: string): Observable<any> {
      return this.http.get(
        this.baseUrl + `/get_annotations/${fileId}`,
        this.createHttpOptions(true),
      );
  }

  /**
   * Adds custom annotation for the given file.
   * @param fileId id of the file
   * @param annotation annotation to add
   */
  addCustomAnnotation(fileId: string, annotation: Annotation): Observable<any> {
    return this.http.patch(
      this.baseUrl + `/add_custom_annotation/${fileId}`,
      annotation,
      this.createHttpOptions(true)
    );
  }

  /**
   * Deletes custom annotation from the given file.
   * @param fileId id of the file that contains the annotation
   * @param uuid uuid of the annotation to be deleted
   * @param deleteAll indicates if all the matching annotations should be deleted
   */
  deleteCustomAnnotation(fileId: string, uuid: string, deleteAll: boolean): Observable<any> {
    return this.http.patch(
      this.baseUrl + `/delete_custom_annotations/${fileId}`,
      { uuid, deleteAll },
      this.createHttpOptions(true)
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
