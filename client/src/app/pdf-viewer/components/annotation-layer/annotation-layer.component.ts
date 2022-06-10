import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  ComponentFactoryResolver,
  ApplicationRef,
  Injector,
  ViewContainerRef
} from '@angular/core';
import { DomPortalOutlet } from '@angular/cdk/portal';

import { isNil, escape, uniqueId, isEmpty } from 'lodash-es';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DatabaseLink, ENTITY_TYPE_MAP, EntityType } from 'app/shared/annotation-types';
import { toValidLink } from 'app/shared/utils/browser';
import { SEARCH_LINKS } from 'app/shared/links';

import { AnnotationToolbarComponent } from './annotation-toolbar.component';
import { Annotation, Location } from '../../annotation-type';
import { PageViewport } from 'pdfjs-dist/types/display/display_utils';

interface ParsedAnnotation {
  highlight: boolean;
  style: string;
  rects: any;
}

@Component({
  selector: 'app-annotation-layer',
  templateUrl: './annotation-layer.component.html',
  styleUrls: ['./annotation-layer.component.scss']
})
export class AnnotationLayerComponent {
  constructor(
    public viewContainerRef: ViewContainerRef
  ) {
  }

  annotations$: Observable<Annotation[]>;
  parsedAnnotations$: Observable<ParsedAnnotation[]> = this.annotations$.pipe(
    map(annotations => annotations.map((annotation) => {
        const opacity = this.normalizeOpacityLevel(annotation);
        const bgcolor = this.normalizeBackgroundColor(annotation);
        const {meta: {allText}, keywords, rects} = annotation;
        return {
          meta: {
            // each annotation should have allText field set.
            allText: allText || (keywords ?? []).join(' '),
          },
          style: {
            opacity: escape(String(opacity)),
            backgroundColor: escape(bgcolor)
          },
          rects: rects.map(rect => {
            const bounds = viewPort.convertToViewportRectangle(rect);
            const left = Math.min(bounds[0], bounds[2]);
            const top = Math.min(bounds[1], bounds[3]);
            const width = Math.abs(bounds[0] - bounds[2]);
            const height = Math.abs(bounds[1] - bounds[3]);
            return {
              style: {
                top, left, width, height
              }
            };
          })
        };
      })
    )
  );


  normalizeTopCoordinate(top: number, an: Annotation): number {
    if (an && an.meta && an.meta.isCustom) {
      return top + 2;
    }
    if (an && an.meta && !an.meta.isCustom) {
      return top - 2;
    }
    return top;
  }

  normalizeOpacityLevel(an: Annotation) {
    const t = an.meta.type.toLowerCase();
    return 1;
  }

  normalizeBackgroundColor(an: Annotation): string {
    return ENTITY_TYPE_MAP[an.meta.type].color;
  }
}
