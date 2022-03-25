import { Component, Input, Output, EventEmitter } from '@angular/core';

import { escape, uniqueId } from 'lodash-es';

import { ENTITY_TYPE_MAP, DatabaseLink, EntityType } from 'app/shared/annotation-types';
import { SEARCH_LINKS } from 'app/shared/links';

import { Annotation } from '../../annotation-type';
import { PageViewport } from 'pdfjs-dist/types/display/display_utils';

@Component({
  selector: 'app-page-annotations',
  templateUrl: './page-annotations.component.html',
  styleUrls: ['./page-annotations.component.scss']
})
export class PageAnnotationsComponent {
  @Input() annotations: Array<any>;
  @Input() highlight;
  @Input() pageViewport: PageViewport;
  @Output() dragStart: EventEmitter<any> = new EventEmitter();

  opacity = 0.3;

  openExclusionPanel(annotation: Annotation) {
    // TODO
  }

  _dragStart(event, annotation, rect) {
    this.dragStart.emit({
      event,
      meta: annotation.meta,
      location: {
        pageNumber: annotation.pageNumber,
        rect
      }
    });
  }

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
    return this.opacity;
  }

  normalizeBackgroundColor(an: Annotation): string {
    return ENTITY_TYPE_MAP[an.meta.type].color;
  }

  removeCustomAnnotation(annotation) {
    //  TODO
  }

  removeAnnotationExclusion(annotation) {
    // TODO
  }

  style(annotation, rect) {
    const bounds = this.pageViewport.convertToViewportRectangle(rect);
    const left = Math.min(bounds[0], bounds[2]);
    let top = Math.min(bounds[1], bounds[3]);
    const width = Math.abs(bounds[0] - bounds[2]);
    const height = Math.abs(bounds[1] - bounds[3]);
    top = this.normalizeTopCoordinate(top, annotation);
    const opacity = this.normalizeOpacityLevel(annotation);
    const bgcolor = this.normalizeBackgroundColor(annotation);
    return {
      opacity: escape(String(opacity)),
      backgroundColor: escape(bgcolor),
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      height: height + 'px',
      cursor: 'move',
      zIndex: '1'
    };
  }

}
