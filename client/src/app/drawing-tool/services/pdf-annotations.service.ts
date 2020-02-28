import { Injectable } from '@angular/core';
import {
  of, Observable
} from 'rxjs'

import { ANNOTATIONS } from './mock_data';
import {
  Annotation
} from './interfaces';

@Injectable({
  providedIn: 'root'
})
export class PdfAnnotationsService {

  constructor() { }

  public getMockupAnnotation():Observable<Object[]> {
    return of(ANNOTATIONS)
  }

  public searchForAnnotation(annotation_id: String): Annotation {
    const ann = (ANNOTATIONS as Annotation[]).filter(
      (ann: Annotation) => ann.id === annotation_id
    )[0] || null;
    return ann;
  }
}
