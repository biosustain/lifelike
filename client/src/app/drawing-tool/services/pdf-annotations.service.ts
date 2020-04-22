import { Injectable } from '@angular/core';
import {
  of, Observable
} from 'rxjs';

import { ANNOTATIONS } from './mock_data';
import {
  Annotation
} from './types';

@Injectable({
  providedIn: 'root'
})
export class PdfAnnotationsService {

  constructor() { }

  /**
   * Send sample annotations
   */
  public getMockupAnnotation(): Observable<any[]> {
    return of(ANNOTATIONS);
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
