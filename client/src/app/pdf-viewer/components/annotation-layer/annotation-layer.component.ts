import {
  ApplicationRef,
  Component,
  ComponentFactoryResolver,
  ElementRef,
  Injector,
  NgZone,
  Output,
  Input,
  EventEmitter,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { kebabCase } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

import { ENTITY_TYPE_MAP } from 'app/shared/constants/annotation-types';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { ExtendedWeakMap } from 'app/shared/utils/types';
import { PDFAnnotationService } from 'app/pdf-viewer/services/pdf-annotation.service';

import { Annotation } from '../../annotation-type';
import { PageViewport } from 'pdfjs-dist/types/display/display_utils';
import { PDFPageView } from '../../pdf-viewer/interfaces';
import { AnnotationLayerDragEvent } from '../../pdf-viewer-lib.component';

@Component({
  selector: 'app-annotation-layer',
  templateUrl: './annotation-layer.component.html',
  styleUrls: ['./annotation-layer.component.scss'],
})
export class AnnotationLayerComponent {
  constructor(
    protected readonly elementRef: ElementRef,
    protected readonly modalService: NgbModal,
    private cfr: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector,
    protected readonly zone: NgZone,
    protected readonly snackBar: MatSnackBar,
    protected readonly errorHandler: ErrorHandler,
    protected readonly internalSearch: InternalSearchService,
    protected readonly clipboard: ClipboardService,
    readonly annotationService: PDFAnnotationService
  ) {}

  annotations$: Observable<Annotation[]> = this.annotationService.pageGroupedAnnotations$.pipe(
    map((gropuedAnnotations) => gropuedAnnotations[(this.pdfPageView as any).id])
  );

  currentHighlightAnnotationId$: Observable<string> = this.annotationService.highlightAnnotationId$;

  @Input() pdfPageView: PDFPageView;
  @Output() dragStart = new EventEmitter<AnnotationLayerDragEvent>();
  annotationRectsMap = new ExtendedWeakMap<
    Annotation,
    { top: number; left: number; width: number; height: number; rect: any }
  >();

  displayFilter(meta) {
    if (meta.isExcluded) {
      return `var(--${kebabCase(meta.type)}, var(--show-excluded))`;
    }
    return `var(--${kebabCase(meta.type)})`;
  }

  normalizeBackgroundColor(an: Annotation): string {
    return ENTITY_TYPE_MAP[an.meta.type].color;
  }

  getAnnotationRects(annotation) {
    return this.annotationRectsMap.getSetLazily(annotation, this.parseAnnotationRects.bind(this));
  }

  parseAnnotationRects(annotation) {
    // each annotation should have allText field set.
    const allText = (annotation.keywords || []).join(' ');
    if (!annotation.meta.allText || annotation.meta.allText === '') {
      annotation.meta.allText = allText;
    }

    const viewPort: PageViewport = this.pdfPageView.viewport;

    return annotation.rects.map((rect) => {
      const bounds = viewPort.convertToViewportRectangle(rect);
      return {
        rect,
        left: Math.min(bounds[0], bounds[2]),
        top: Math.min(bounds[1], bounds[3]),
        width: Math.abs(bounds[0] - bounds[2]),
        height: Math.abs(bounds[1] - bounds[3]),
      };
    });
  }

  annotationDragStart(event, { meta, rect }) {
    this.dragStart.emit({
      event,
      meta,
      rect,
    });
    event.stopPropagation();
  }

  removeCustomAnnotation({ uuid }: Annotation) {
    return this.annotationService.annotationRemoved(uuid);
  }

  openExclusionPanel(annotation) {
    return this.annotationService.openExclusionPanel({
      id: annotation.meta.id,
      idHyperlinks: annotation.meta.idHyperlinks,
      text: annotation.textInDocument,
      type: annotation.meta.type,
      rects: annotation.rects,
      pageNumber: annotation.pageNumber,
    });
  }

  addHighlightItem(highlightRect: number[]) {
    const viewPort: PageViewport = this.pdfPageView.viewport;
    const bounds = viewPort.convertToViewportRectangle(highlightRect);
    const left = Math.min(bounds[0], bounds[2]);
    const top = Math.min(bounds[1], bounds[3]);
    const width = Math.abs(bounds[0] - bounds[2]);
    const height = Math.abs(bounds[1] - bounds[3]);
    // TODO don't use direct DOM manipulations
    const overlayContainer = this.elementRef.nativeElement;
    const overlayDiv = document.createElement('div');
    overlayDiv.setAttribute(
      'style',
      `border: 2px solid red; position:absolute;` +
        'left:' +
        (left - 4) +
        'px;top:' +
        (top - 4) +
        'px;width:' +
        (width + 8) +
        'px;height:' +
        (height + 8) +
        'px;'
    );
    overlayContainer.appendChild(overlayDiv);
    setTimeout(() => {
      overlayContainer.removeChild(overlayDiv);
    }, 3000);
  }

  removeAnnotationExclusion(annotation) {
    return this.annotationService.annotationExclusionRemoved({
      text: annotation.textInDocument,
      type: annotation.meta.type,
    });
  }
}
