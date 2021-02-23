import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AddedAnnotationExclusion, Annotation, Location, Meta, Rect, RemovedAnnotationExclusion, } from './annotation-type';
import { PDFDocumentProxy, PDFProgressData, PDFSource } from './pdf-viewer/pdf-viewer.module';
import { PdfViewerComponent, RenderTextMode } from './pdf-viewer/pdf-viewer.component';
import { PDFPageViewport } from 'pdfjs-dist';
import { AnnotationEditDialogComponent } from './components/annotation-edit-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AnnotationExcludeDialogComponent } from './components/annotation-exclude-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { escape, uniqueId } from 'lodash';
import { SEARCH_LINKS } from 'app/shared/links';

import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';

declare var jQuery: any;

declare enum FindState {
  FOUND = 0,
  NOT_FOUND = 1,
  WRAPPED = 2,
  PENDING = 3,
}

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'lib-pdf-viewer-lib',
  templateUrl: './pdf-viewer-lib.component.html',
  styleUrls: ['./pdf-viewer-lib.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PdfViewerLibComponent implements OnInit, OnDestroy {
  @Input() searchChanged: Subject<{ keyword: string, findPrevious: boolean }>;
  private searchChangedSub: Subscription;
  @Input() pdfSrc: string | PDFSource | ArrayBuffer;
  @Input() annotations: Annotation[];
  @Input() goToPosition: Subject<Location>;
  @Input() highlightAnnotations: Observable<string>;
  @Input() debugMode: boolean;
  @Input() entityTypeVisibilityMap: Map<string, boolean> = new Map();
  @Input() filterChanges: Observable<void>;
  renderTextMode: RenderTextMode = RenderTextMode.ENHANCED;
  currentHighlightAnnotationId: string | undefined;
  foundHighlightAnnotations: Annotation[] = [];
  currentHighlightAnnotationsIndex = 0;
  private filterChangeSubscription: Subscription;
  searching = false;

  @Input()
  set addedAnnotations(annotations: Annotation[]) {
    if (annotations) {
      annotations.forEach(annotation => {
        this.addAnnotation(annotation, annotation.pageNumber);
        this.annotations.push(annotation);
        this.updateAnnotationVisibility(annotation);
      });
    }
  }

  @Input()
  set removedAnnotationIds(uuids: string[]) {
    if (uuids) {
      const removedAnnotations = this.annotations.filter((ann: Annotation) => uuids.includes(ann.uuid));
      removedAnnotations.forEach((ann: Annotation) => {
        const ref = this.annotationHighlightElementMap.get(ann);
        jQuery(ref).remove();
      });
      this.annotations = this.annotations.filter((ann: Annotation) => !uuids.includes(ann.uuid));
    }
  }

  @Input()
  set addedAnnotationExclusion(exclusionData: AddedAnnotationExclusion) {
    if (exclusionData) {
      this.markAnnotationExclusions(exclusionData);
    }
  }

  @Input()
  set removedAnnotationExclusion(exclusionData: RemovedAnnotationExclusion) {
    if (exclusionData) {
      this.unmarkAnnotationExclusions(exclusionData);
    }
  }

  // tslint:disable-next-line: variable-name
  private _showExcludedAnnotations: boolean;
  @Input()
  set showExcludedAnnotations(showExcludedAnnotations: boolean) {
    this._showExcludedAnnotations = showExcludedAnnotations;
    this.renderFilterSettings();
  }

  get showExcludedAnnotations() {
    return this._showExcludedAnnotations;
  }

  @Output() loadCompleted = new EventEmitter();
  @Output() annotationDragStart = new EventEmitter<any>();
  // tslint:disable
  @Output('custom-annotation-created') annotationCreated = new EventEmitter();
  @Output('custom-annotation-removed') annotationRemoved = new EventEmitter();
  @Output('annotation-exclusion-added') annotationExclusionAdded = new EventEmitter();
  @Output('annotation-exclusion-removed') annotationExclusionRemoved = new EventEmitter();
  @Output() searchChange = new EventEmitter<string>();
  @Output() annotationHighlightChange = new EventEmitter<AnnotationHighlightResult>();

  /**
   * Stores a mapping of annotations to the HTML elements that are used to show it.
   */
  private readonly annotationHighlightElementMap: Map<Annotation, HTMLElement[]> = new Map();

  pendingHighlights = {};

  error: any;
  page = 1;
  rotation = 0;
  zoom = 1.0;
  originalSize = false;
  pdf: any;
  renderText = true;
  progressData: PDFProgressData;
  isLoaded = false;
  isLoadCompleted = false;
  stickToPage = false;
  showAll = true;
  autoresize = true;
  fitToPage = false;
  outline: any[];
  isOutlineShown = false;
  pdfQuery = '';
  allPages = 0;
  currentRenderedPage = 0;
  showNextFindFeedback = false;

  pageRef = {};
  index: any;

  allText: string;
  selectedText: string[];
  selectedTextCoords: Rect[];
  currentPage: number;
  selectedElements: HTMLElement[] = [];

  opacity = 0.3;

  dragAndDropOriginCoord;
  dragAndDropOriginHoverCount;
  dragAndDropDestinationCoord;
  dragAndDropDestinationHoverCount;

  pdfViewerId = uniqueId();

  matchesCount = {
    current: 0,
    total: 0,
  };

  searchCommand: string;

  @ViewChild(PdfViewerComponent, {static: false})
  private pdfComponent: PdfViewerComponent;

  constructor(
    private readonly modalService: NgbModal,
    private zone: NgZone,
    private snackBar: MatSnackBar,
  ) {
  }

  ngOnInit() {
    (window as any).pdfViewerRef = (window as any).pdfViewerRef || {};
    (window as any).pdfViewerRef[this.pdfViewerId] = {
      openAnnotationPanel: () => this.zone.run(() => this.openAnnotationPanel()),
      copySelectedText: () => this.zone.run(() => this.copySelectedText()),
      removeCustomAnnotation: (uuid) => this.zone.run(() => this.removeCustomAnnotation(uuid)),
      openExclusionPanel: (annExclusion) => this.zone.run(() => this.openExclusionPanel(annExclusion)),
      removeAnnotationExclusion: (annExclusion) => this.zone.run(() => this.removeAnnotationExclusion(annExclusion)),
      highlightAllAnnotations: (id, toggle = true) => this.zone.run(() => this.highlightAllAnnotations(id, toggle)),
    };

    this.goToPosition.subscribe((sub) => {
      if (!this.isLoadCompleted && sub) {
        // Pdf viewer is not ready to go to a position
        return;
      }
      if (sub != null) {
        if (sub.pageNumber != null) {
          this.scrollToPage(sub.pageNumber, sub.rect);
        } else if (sub.jumpText != null) {
          const simplified = sub.jumpText.replace(/[\s\r\n]/g, ' ').trim();
          const words = simplified.split(/ /g);
          const prefixQuery = words.splice(0, 4).join(' ');
          this.showNextFindFeedback = true;
          this.searchQueryChanged({
            keyword: prefixQuery,
            findPrevious: true,
          });
        }
      }
    });

    this.highlightAnnotations.subscribe((sub) => {
      if (!this.isLoadCompleted && sub) {
        // Pdf viewer is not ready to go to a position
        return;
      }
      this.highlightAllAnnotations(sub);
    });

    if (this.debugMode) {
      jQuery(document).on('click', '.system-annotation', event => {
        const target = event.target;
        const location = JSON.parse(jQuery(target).attr('location')) as Location;
        const meta = JSON.parse(jQuery(target).attr('meta')) as Meta;
      });
    }

    if (this.filterChanges) {
      this.filterChangeSubscription = this.filterChanges.subscribe(() => this.renderFilterSettings());
    }

    this.searchChangedSub = this.searchChanged.pipe(
      debounceTime(250)).subscribe((sb) => {
      this.searchQueryChanged(sb);
    });
  }

  ngOnDestroy(): void {

    if (this.filterChangeSubscription) {
      this.filterChangeSubscription.unsubscribe();
    }

    if (this.searchChangedSub) {
      this.searchChangedSub.unsubscribe();
    }

    delete (window as any).pdfViewerRef[this.pdfViewerId];

  }

  renderFilterSettings() {
    for (const annotation of this.annotations) {
      this.updateAnnotationVisibility(annotation);
    }
  }

  updateAnnotationVisibility(annotation: Annotation) {
    let visible = this.entityTypeVisibilityMap.get(annotation.meta.type);
    if (visible == null) {
      visible = true;
    }
    const elements = this.annotationHighlightElementMap.get(annotation);
    if (elements) {
      for (const element of elements) {
        if (visible && (!annotation.meta.isExcluded || (annotation.meta.isExcluded && this.showExcludedAnnotations))) {
          element.style.display = 'block';
        } else {
          element.style.display = 'none';
        }
      }
    }
  }

  addAnnotation(annotation: Annotation, pageNum: number) {
    const pdfPageView = this.pageRef[pageNum];
    const viewPort: PDFPageViewport = pdfPageView.viewport;

    // each annotation should have allText field set.
    const allText = (annotation.keywords || []).join(' ');
    if (!annotation.meta.allText || annotation.meta.allText === '') {
      annotation.meta.allText = allText;
    }

    const elementRefs = [];
    this.annotationHighlightElementMap.set(annotation, elementRefs);

    for (const rect of annotation.rects) {
      const bounds = viewPort.convertToViewportRectangle(rect);
      const left = Math.min(bounds[0], bounds[2]);
      let top = Math.min(bounds[1], bounds[3]);
      const width = Math.abs(bounds[0] - bounds[2]);
      const height = Math.abs(bounds[1] - bounds[3]);
      const overlayContainer = pdfPageView.div;
      const overlayDiv = document.createElement('div');
      const location: Location = {
        pageNumber: annotation.pageNumber,
        rect,
      };
      overlayDiv.setAttribute('draggable', 'true');
      overlayDiv.addEventListener('dragstart', event => {
        this.annotationDragStart.emit(event);
      });
      overlayDiv.dataset.annotationId = annotation.meta.id;
      overlayDiv.setAttribute('class', 'system-annotation'
        + (this.currentHighlightAnnotationId === annotation.meta.id
          ? ' annotation-highlight' : ''));
      overlayDiv.setAttribute('location', JSON.stringify(location));
      overlayDiv.setAttribute('meta', JSON.stringify(annotation.meta));
      top = this.normalizeTopCoordinate(top, annotation);
      const opacity = this.normalizeOpacityLevel(annotation);
      const bgcolor = this.normalizeBackgroundColor(annotation);
      overlayDiv.setAttribute('style', `opacity:${escape(opacity)}; background-color: ${escape(bgcolor)};position:absolute;` +
        'left:' + left + 'px;top:' + (top) + 'px;width:' + width + 'px;height:' + height + 'px;');
      overlayContainer.appendChild(overlayDiv);
      (annotation as any).ref = overlayDiv;
      elementRefs.push(overlayDiv);
      jQuery(overlayDiv).css('cursor', 'move');
      (jQuery(overlayDiv) as any).qtip(
        {
          content: this.prepareTooltipContent(annotation),
          position: {
            my: 'top center',
            at: 'bottom center',
            viewport: true,
            target: this,
          },
          style: {
            classes: 'qtip-bootstrap',
            tip: {
              width: 16,
              height: 8,
            },
          },
          show: {
            delay: 10,
          },
          hide: {
            fixed: true,
            delay: 150,
          },
        },
      );
    }
    if (this.pendingHighlights[pageNum]) {
      const rect = this.pendingHighlights[pageNum];
      delete this.pendingHighlights[pageNum];
      this.addHighlightItem(pageNum, rect);
    }

    this.updateAnnotationVisibility(annotation);
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

  prepareTooltipContent(an: Annotation): string {
    let base = [`Type: ${an.meta.type}`];
    if (an.meta.id) {
      if (an.meta.idHyperlink) {
        base.push(`Id: <a href=${escape(an.meta.idHyperlink)} target="_blank">${escape(an.meta.id)}</a>`);
      } else {
        base.push(`Id: ${escape(an.meta.id)}`);
      }
    }
    if (an.meta.idType) {
      base.push(`Id Type: ${escape(an.meta.idType)}`);
    }
    if (an.meta.isCustom) {
      base.push(`User generated annotation`);
    }
    // search links
    const collapseTargetId = uniqueId('pdf-tooltip-collapse-target');
    let collapseHtml = `
      <a class="pdf-tooltip-collapse-control collapsed" role="button" data-toggle="collapse" data-target="#${collapseTargetId}" aria-expanded="false" aria-controls="${collapseTargetId}">
        Search links <i class="fas fa-external-link-alt ml-1 text-muted"></i>
      </a>
      <div class="collapse" id="${collapseTargetId}">
    `;
    // links should be sorted in the order that they appear in SEARCH_LINKS
    for (const {domain, url} of SEARCH_LINKS) {
      const link = an.meta.links[domain.toLowerCase()] || url.replace(/%s/, encodeURIComponent(an.meta.allText));
      collapseHtml += `<a target="_blank" href="${escape(link)}">${escape(domain)}</a><br/>`;
    }
    collapseHtml += `
      </div>
    `;
    base.push(collapseHtml);
    base = [base.join('<br/>')];

    if (an.meta.isCustom) {
      base.push(`
        <div class="mt-1">
          <button type="button" class="btn btn-primary btn-block" onclick="window.pdfViewerRef['${this.pdfViewerId}'].removeCustomAnnotation(${escape(
        JSON.stringify(an.uuid))})">
            <i class="fas fa-fw fa-trash"></i>
            <span>Delete Annotation</span>
          </button>
        </div>
      `);
    }
    if (!an.meta.isCustom && !an.meta.isExcluded) {
      const annExclusion = {
        id: an.meta.id,
        idHyperlink: an.meta.idHyperlink,
        text: an.textInDocument,
        type: an.meta.type,
        rects: an.rects,
        pageNumber: an.pageNumber
      };
      base.push(`
        <div class="mt-1">
          <button type="button" class="btn btn-primary btn-block" onclick="window.pdfViewerRef['${this.pdfViewerId}'].openExclusionPanel(${escape(
        JSON.stringify(annExclusion))})">
            <i class="fas fa-fw fa-minus-circle"></i>
            <span>Mark for Exclusion</span>
          </button>
        </div>
      `);
    }
    base.push(`
        <div class="mt-1">
          <button type="button" class="btn btn-secondary btn-block" onclick="window.pdfViewerRef['${this.pdfViewerId}'].highlightAllAnnotations(${escape(
      JSON.stringify(an.meta.id))}, false);jQuery('.system-annotation').qtip('hide')">
            <i class="fas fa-fw fa-search"></i>
            <span>Find Occurrences</span>
          </button>
        </div>
      `);
    if (an.meta.isExcluded) {
      const annExclusion = {
        text: an.textInDocument,
        type: an.meta.type
      };
      base.push(`
        <div class="mt-2">
          <div style="display: flex; flex-direction: column">
            <span style="line-height: 16px">Manually excluded</span>
            <span style="line-height: 16px"><i>reason: </i>${escape(an.meta.exclusionReason)}</span>
            ${an.meta.exclusionComment ? `<span style="line-height: 16px"><i>comment: </i>${escape(an.meta.exclusionComment)}</span>` : ''}
          </div>
          <div class="mt-1">
            <button type="button" class="btn btn-primary btn-block" onclick="window.pdfViewerRef['${this.pdfViewerId}'].removeAnnotationExclusion(${escape(
        JSON.stringify(annExclusion))})">
              <i class="fas fa-fw fa-undo"></i>
              <span>Unmark Exclusion</span>
            </button>
          </div>
        </div>`);
    }
    return base.join('');
  }

  processAnnotations(pageNum: number, pdfPageView: any) {
    this.pageRef[pageNum] = pdfPageView;
    const filteredAnnotations = this.annotations.filter((an) => an.pageNumber === pageNum);
    for (const an of filteredAnnotations) {
      this.addAnnotation(an, pageNum);
    }
  }

  @HostListener('window:mousedown', ['$event'])
  mouseDown(event: MouseEvent) {
    let target = event.target as any;
    let parent = target.closest('.textLayer');
    if (parent) {
      parent.style.zIndex = 100;
      // coming from pdf-viewer
      // prepare it for drag and drop
      this.dragAndDropOriginCoord = {
        pageX: event.pageX,
        pageY: event.pageY,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      this.dragAndDropOriginHoverCount = jQuery('.textLayer > span:hover').length || 0;
    }
  }

  mouseUp = event => {
    const targetTagName = event.target.tagName;
    if (targetTagName === 'INPUT') {
      return false;
    }

    const isItToolTip = event.target.closest('.qtip-content');
    this.dragAndDropDestinationHoverCount = jQuery('.textLayer > span:hover').length || 0;
    const spanCheck = this.dragAndDropDestinationHoverCount !== 1 || this.dragAndDropOriginHoverCount !== 1;
    if (spanCheck && !isItToolTip) {
      this.dragAndDropOriginHoverCount = 0;
      this.dragAndDropDestinationHoverCount = 0;
      this.deleteFrictionless();
      this.clearSelection();
    }
    const selection = window.getSelection() as any;
    const baseNode = selection.baseNode;
    const parent = baseNode && baseNode.parentNode as any;
    if (!parent || !parent.closest('.textLayer')) {
      // coming not from pdf-viewer
      return false;
    }
    parent.closest('.textLayer').style.zIndex = null;
    const range = selection.getRangeAt(0);
    const selectionBounds = range.getBoundingClientRect();
    const selectedRects = selection.getRangeAt(0).getClientRects();
    if (selectedRects.length === 0) {
      this.clearSelection();
      return false;
    }
    if (selectedRects.length === 1) {
      const firstRect = selectedRects[0];
      const width = firstRect.width;
      if (width < 1) {
        this.clearSelection();
        this.deleteFrictionless();
        return false;
      }
    }
    this.deleteFrictionless();
    this.allText = selection.toString();
    const documentFragment = selection.getRangeAt(0).cloneContents();
    let children = documentFragment.childNodes;
    this.dragAndDropDestinationCoord = {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    };
    this.selectedText = Array.from(children).map((node: any) => node.textContent);
    //this.selectedText = Array.from(documentFragment.childNodes).map((node: any) => node.textContent);
    this.currentPage = parseInt(parent.closest('.page').getAttribute('data-page-number'), 10);
    const pdfPageView = this.pageRef[this.currentPage];
    const viewport = pdfPageView.viewport;
    const pageElement = pdfPageView.div;
    const pageRect = pdfPageView.canvas.getClientRects()[0];
    const originConverted = viewport.convertToPdfPoint(this.dragAndDropOriginCoord.clientX - pageRect.left,
      this.dragAndDropOriginCoord.clientY - pageRect.top);
    const destinationConverted = viewport.convertToPdfPoint(this.dragAndDropDestinationCoord.clientX - pageRect.left,
      this.dragAndDropDestinationCoord.clientY - pageRect.top);
    const mouseMoveRectangular = viewport.convertToViewportRectangle([].concat(originConverted).concat(destinationConverted));
    const mouseRectTop = Math.min(mouseMoveRectangular[1], mouseMoveRectangular[3]);
    const mouseRectHeight = Math.abs(mouseMoveRectangular[1] - mouseMoveRectangular[3]);

    const fixedSelectedRects = [];
    const newLineThreshold = .30;

    const clonedSelection = selection.getRangeAt(0).cloneContents();

    let rects = [];
    const elements: any[] = Array.from(clonedSelection.children);
    elements.forEach((org_span: any) => {
      const span = org_span.cloneNode(true);
      const {transform} = span.style;
      const transform_match = transform.match(/[\d\.]+/);

      // decompose https://github.com/mozilla/pdf.js/blob/b1d3b6eb12b471af060c40a2d1fe479b1878ceb7/src/display/text_layer.js#L679:L739
      span.style.padding = null;
      if (transform_match) {
        span.style.transform = `scaleX(${transform_match[0]})`;
      }
      span.style.display = 'block';
      span.style.position = 'absolute';
      span.style.lineHeight = 1;
      span.style.transformOrigin = '0% 0%';

      pageElement.appendChild(span);

      rects = [...rects, ...span.getClientRects()];

      span.remove();
    });

    rects[0] = selectedRects[0]; // first one used to be wrong

    function createCorrectRects(rects: Array<DOMRect>) {
      let startLowerX = null, startLowerY = null;

      let currentRect = new DOMRect(0, 0, 0, 0);

      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const prevRect = i > 0 ? rects[i - 1] : rect;
        // point of origin in browser is top left
        const lowerX = rect.left;
        const lowerY = rect.bottom;

        currentRect.height = rect.height > currentRect.height ? rect.height : currentRect.height;

        if (startLowerX === null && startLowerY === null) {
          startLowerX = lowerX;
          startLowerY = lowerY;
        } else {
          // if the lowerY of current rect is not equal to the
          // lowerY of the very first word selection in the highlight
          // it means potentially the current word selection rectangle
          // is on a new line or just have larger font size
          if (lowerY !== startLowerY) {
            // calculate threshold and determine if new line
            const diff = Math.abs(lowerY - startLowerY);
            const prevHeight = prevRect.height;

            if (diff > prevHeight * newLineThreshold) {
              const rectsOnNewLine = [];
              for (let j = i; j < rects.length; j++) {
                rectsOnNewLine.push(rects[j]);
              }

              const unprocessedDOMRects = {length: rectsOnNewLine.length} as Array<DOMRect>;
              rectsOnNewLine.forEach((r, i) => unprocessedDOMRects[i] = r);
              createCorrectRects(unprocessedDOMRects);
              // break because the recursion already calculated the
              // correct currentRect.width before returning
              break;
            }
          }
        }

        currentRect.x = startLowerX;
        currentRect.y = startLowerY - currentRect.height;

        if (currentRect.width === 0) {
          currentRect.width = rect.width;
        } else if (rect.width !== prevRect.width) {
          currentRect.width = rect.x - currentRect.x + rect.width;
        }
      }

      fixedSelectedRects.push(currentRect);
    }

    // We need to re-create the selection rectangles
    // because the PDF could be in a weird format
    // that causes the native browser API to create multiple
    // DOM rectangles when it shouldn't have.
    //
    // Each section rectangle represent one selection,
    // this means multiple words on the same line should
    // create one selection rectangle
    // See LL-1437 (https://github.com/SBRG/kg-prototypes/pull/474)
    createCorrectRects(rects);

    this.selectedTextCoords = [];
    const that = this;
    let avgHeight = 0;
    let rectHeights = [];
    jQuery.each(fixedSelectedRects, (idx, r) => {

      const rect = viewport.convertToPdfPoint(r.left - pageRect.left, r.top - pageRect.top)
        .concat(viewport.convertToPdfPoint(r.right - pageRect.left, r.bottom - pageRect.top));
      that.selectedTextCoords.push(rect);
      const bounds = viewport.convertToViewportRectangle(rect);
      let left = Math.min(bounds[0], bounds[2]);
      let top = Math.min(bounds[1], bounds[3]);
      let width = Math.abs(bounds[0] - bounds[2]);
      let height = Math.abs(bounds[1] - bounds[3]);
      rectHeights.push(height);
      avgHeight = rectHeights.reduce((a, b) => a + b) / rectHeights.length;
      if ((avgHeight * 2) < height) {
        // rejected by line average
        rectHeights.pop();
        return; //continue
      }

      const mouseRecTopBorder = mouseRectTop - Number(avgHeight * 1.2);
      const mouseRectBottomBorder = mouseRectTop + mouseRectHeight + Number(avgHeight * 1.2);

      const el = document.createElement('div');
      const meta: Meta = {
        allText: that.allText,
        type: 'link',
      };
      const location: Location = {
        pageNumber: that.currentPage,
        rect: that.getMultilinedRect(),
      };
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', event => {
        jQuery('.frictionless-annotation').qtip('hide');
        this.annotationDragStart.emit(event);
      });
      el.setAttribute('location', JSON.stringify(location));
      el.setAttribute('meta', JSON.stringify(meta));
      el.setAttribute('class', 'frictionless-annotation');
      el.setAttribute('style', `
        position: absolute;
        background-color: rgba(255, 255, 51, 0.3);
        left: ${left}px;
        top: ${top}px;
        width: ${width}px;
        height: ${height}px;
      `);
      el.setAttribute('id', 'newElement' + idx);

      if (mouseRecTopBorder <= top && mouseRectBottomBorder >= top) {
        pageElement.appendChild(el);
        this.selectedElements.push(el);
      }

      jQuery(el).css('cursor', 'move');
      (jQuery(el) as any).qtip(
        {

          content: `<img src="assets/images/annotate.png" onclick="window.pdfViewerRef['${this.pdfViewerId}'].openAnnotationPanel()">
                <img src="assets/images/copy.png" onclick="window.pdfViewerRef['${this.pdfViewerId}'].copySelectedText()">`,
          position: {
            my: 'bottom center',
            target: 'mouse',
            adjust: {
              mouse: false,
            },
          },
          style: {
            classes: 'qtip-bootstrap',
            tip: {
              width: 16,
              height: 8,
            },
          },
          show: {
            delay: 10,
          },
          hide: {
            fixed: true,
            delay: 200,
          },
        },
      );
    });

    this.clearSelection();
  };

  deleteFrictionless() {
    jQuery('.frictionless-annotation').qtip('destroy');
    jQuery('.frictionless-annotation').remove();
  }

  resetSelection() {
    this.selectedText = [];
    this.selectedTextCoords = [];
    this.allText = '';
    this.selectedElements = [];
  }

  openAnnotationPanel() {
    jQuery('.frictionless-annotation').qtip('hide');

    const dialogRef = this.modalService.open(AnnotationEditDialogComponent);
    dialogRef.componentInstance.allText = this.allText;
    dialogRef.componentInstance.keywords = this.selectedText;
    dialogRef.componentInstance.coords = this.selectedTextCoords;
    dialogRef.componentInstance.pageNumber = this.currentPage;
    dialogRef.result.then(annotation => {
      this.annotationCreated.emit(annotation);
      this.deleteFrictionless();
      this.resetSelection();
    }, () => {
    });
  }

  openExclusionPanel(annExclusion) {
    jQuery('.system-annotation').qtip('hide');

    const dialogRef = this.modalService.open(AnnotationExcludeDialogComponent);
    dialogRef.componentInstance.text = annExclusion.text;
    dialogRef.componentInstance.type = annExclusion.type;
    dialogRef.result.then(exclusionData => {
      this.annotationExclusionAdded.emit({...exclusionData, ...annExclusion});
    }, () => {
    });
  }

  removeAnnotationExclusion(annExclusion) {
    jQuery('.system-annotation').qtip('hide');
    this.annotationExclusionRemoved.emit(annExclusion);
  }

  clearSelection() {
    const sel = window.getSelection();
    sel.removeAllRanges();
  }

  /**
   * Set custom path to pdf worker
   */
  setCustomWorkerPath() {
    (window as any).pdfWorkerSrc = '/lib/pdfjs-dist/build/pdf.worker.js';
  }

  incrementPage(amount: number) {
    this.page += amount;
  }

  incrementZoom(amount: number) {
    this.zoom += amount;
  }

  setZoom(amount: number) {
    this.zoom = amount;
  }

  rotate(angle: number) {
    this.rotation += angle;
  }

  /**
   * Render PDF preview on selecting file
   */
  onFileSelected() {
    const $pdf: any = document.querySelector('#file');

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        this.pdfSrc = e.target.result;
      };

      reader.readAsArrayBuffer($pdf.files[0]);
    }
  }

  /**
   * Get pdf information after it's loaded
   */
  afterLoadComplete(pdf: PDFDocumentProxy) {
    this.pdf = pdf;

    this.loadOutline();

    // setTimeout(() => {
    //  this.loadCompleted.emit(true);
    // }, 2000);

    // this.isLoadCompleted = true;
  }

  /**
   * Get outline
   */
  loadOutline() {
    this.pdf.getOutline().then((outline: any[]) => {
      this.outline = outline;
    });
  }

  /**
   * Handle error callback
   */
  onError(error: any) {
    this.error = error; // set error
    console.log(error);
  }


  /**
   * Pdf loading progress callback
   */
  onProgress(progressData: PDFProgressData) {
    this.progressData = progressData;

    this.isLoaded = progressData.loaded >= progressData.total;
    this.error = null; // clear error
  }

  getInt(value: number): number {
    return Math.round(value);
  }

  /**
   * Navigate to destination
   */
  navigateTo(destination: any) {
    this.pdfComponent.pdfLinkService.navigateTo(destination);
  }

  /**
   * Scroll view
   */
  scrollToPage(pageNum: number, highlightRect?: number[]) {
    this.pdfComponent.pdfViewer.scrollPageIntoView({
      pageNumber: pageNum,
    });
    if (highlightRect && highlightRect.length > 0) {
      setTimeout(() => {
        this.addHighlightItem(pageNum, highlightRect);
      }, 500);
    }
  }

  highlightAllAnnotations(id: string | undefined, toggle = true) {
    if (toggle && id != null) {
      if (this.currentHighlightAnnotationId === id) {
        id = null;
      }
    }

    this.currentHighlightAnnotationId = id;
    const foundHighlightAnnotations = [];

    let firstPageNumber = null;
    let firstAnnotation: Annotation = null;

    for (const annotation of this.annotations) {
      if (annotation.meta.id === id) {
        foundHighlightAnnotations.push(annotation);
        if (!firstAnnotation) {
          firstAnnotation = annotation;
          firstPageNumber = annotation.pageNumber;
        }
      }
    }

    for (const pageIndex of Object.keys(this.pageRef)) {
      const page = this.pageRef[pageIndex];
      const overlays = (page as any).div.querySelectorAll('.system-annotation');
      for (const overlay of overlays) {
        if (overlay.dataset.annotationId === id) {
          overlay.classList.add('annotation-highlight');
        } else {
          overlay.classList.remove('annotation-highlight');
        }
      }
    }

    this.foundHighlightAnnotations = foundHighlightAnnotations;
    this.currentHighlightAnnotationsIndex = 0;
    this.annotationHighlightChange.emit(id != null ? {
      id,
      firstAnnotation,
      firstPageNumber,
      found: foundHighlightAnnotations.length,
    } : null);

    if (id != null) {
      this.nullifyMatchesCount();
      this.searchQueryChanged({
        keyword: '',
        findPrevious: true,
      });

      if (foundHighlightAnnotations.length) {
        this.snackBar.open(
          `Highlighted ${foundHighlightAnnotations.length} instance${foundHighlightAnnotations.length === 1 ? '' : 's'}  `
          + (firstAnnotation != null ? `of '${firstAnnotation.meta.allText}' ` : '')
          + `in the document, starting on page ${firstPageNumber}.`,
          'Close', {duration: 5000});

        this.scrollToPage(firstPageNumber, firstAnnotation.rects[0]);
      } else {
        this.snackBar.open(`The annotation could not be found in the document.`,
          'Close', {duration: 5000});
      }
    }
  }

  previousAnnotationHighlight() {
    if (this.currentHighlightAnnotationsIndex != null && this.foundHighlightAnnotations.length) {
      let previousIndex = this.currentHighlightAnnotationsIndex - 1;
      if (previousIndex < 0) {
        previousIndex = this.foundHighlightAnnotations.length - 1;
      }
      this.currentHighlightAnnotationsIndex = previousIndex;
      const annotation = this.foundHighlightAnnotations[previousIndex];
      this.addHighlightItem(annotation.pageNumber, annotation.rects[0]);
    }
  }

  nextAnnotationHighlight() {
    if (this.currentHighlightAnnotationsIndex != null && this.foundHighlightAnnotations.length) {
      let nextIndex = this.currentHighlightAnnotationsIndex + 1;
      if (nextIndex >= this.foundHighlightAnnotations.length) {
        nextIndex = 0;
      }
      this.currentHighlightAnnotationsIndex = nextIndex;
      const annotation = this.foundHighlightAnnotations[nextIndex];
      this.addHighlightItem(annotation.pageNumber, annotation.rects[0]);
    }
  }

  clearResults() {
    this.highlightAllAnnotations(null);
    this.searchQueryChanged({
      keyword: '',
      findPrevious: true,
    });
  }

  addHighlightItem(pageNum: number, highlightRect: number[]) {
    const pdfPageView = this.pageRef[pageNum];
    if (!pdfPageView) {
      this.pendingHighlights[pageNum] = highlightRect;
      return;
    }
    const viewPort: PDFPageViewport = pdfPageView.viewport;
    const bounds = viewPort.convertToViewportRectangle(highlightRect);
    const left = Math.min(bounds[0], bounds[2]);
    const top = Math.min(bounds[1], bounds[3]);
    const width = Math.abs(bounds[0] - bounds[2]);
    const height = Math.abs(bounds[1] - bounds[3]);
    const overlayContainer = pdfPageView.div;
    const overlayDiv = document.createElement('div');
    overlayDiv.setAttribute('style', `border: 2px solid red; position:absolute;` +
      'left:' + (left - 4) + 'px;top:' + (top - 4) + 'px;width:' + (width + 8) + 'px;height:' + (height + 8) + 'px;');
    overlayContainer.appendChild(overlayDiv);
    overlayDiv.scrollIntoView({block: 'center'});
    jQuery(overlayDiv).effect('highlight', {}, 1000);
    setTimeout(() => {
      jQuery(overlayDiv).remove();
    }, 3000);
  }

  /**
   * Page rendered callback, which is called when a page is rendered (called multiple times)
   */
  pageRendered(e: CustomEvent) {
    this.allPages = this.pdf.numPages;
    this.currentRenderedPage = (e as any).pageNumber;
    // const nump = Number(this.pdf.numPages);
    // const currentNump = Number((e as any).pageNumber);
    // if (nump === currentNump) {
    //     this.isLoadCompleted = true;
    //     setTimeout(() => {
    //         this.loadCompleted.emit(true);
    //     }, 1000);
    // }
    const pageNum = (e as any).pageNumber;
    const pdfPageView = (e as any).source;
    this.processAnnotations(pageNum, pdfPageView);
  }

  searchQueryChanged(newQuery: { keyword: string, findPrevious: boolean }) {
    const keyword = newQuery.keyword.trim();
    if (keyword.length) {
      this.highlightAllAnnotations(null);
    }
    this.searchChange.emit(keyword);
    if (newQuery.keyword !== this.pdfQuery) {
      this.pdfQuery = newQuery.keyword;
      this.searchCommand = 'find';
      this.pdfComponent.pdfFindController.executeCommand('find', {
        query: this.pdfQuery,
        highlightAll: true,
        phraseSearch: true,
        findPrevious: newQuery.findPrevious,
      });
    } else {
      this.searchCommand = 'findagain';
      this.pdfComponent.pdfFindController.executeCommand('findagain', {
        query: this.pdfQuery,
        highlightAll: true,
        phraseSearch: true,
        findPrevious: newQuery.findPrevious,
      });
    }
  }

  copySelectedText() {
    let listener = (e: ClipboardEvent) => {
      let clipboard = e.clipboardData || window['clipboardData'];
      clipboard.setData('text', this.allText);
      e.preventDefault();
    };

    document.addEventListener('copy', listener, false);
    document.execCommand('copy');
    document.removeEventListener('copy', listener, false);

    this.deleteFrictionless();

    this.snackBar.open('It has been copied to clipboard', 'Close', {duration: 5000});

  }

  removeCustomAnnotation(uuid) {
    jQuery('.system-annotation').qtip('hide');
    this.annotationRemoved.emit(uuid);
  }

  termsMatch(termInExclusion, termInAnnotation, isCaseInsensitive) {
    if (isCaseInsensitive) {
      return termInExclusion.toLowerCase() === termInAnnotation.toLowerCase();
    }
    return termInExclusion === termInAnnotation;
  }

  markAnnotationExclusions(exclusionData: AddedAnnotationExclusion) {
    this.annotations.forEach((ann: Annotation) => {
      if (ann.meta.type === exclusionData.type &&
        this.termsMatch(exclusionData.text, ann.textInDocument, exclusionData.isCaseInsensitive)) {
        const ref = this.annotationHighlightElementMap.get(ann);
        jQuery(ref).remove();
        ann.meta.isExcluded = true;
        ann.meta.exclusionReason = exclusionData.reason;
        ann.meta.exclusionComment = exclusionData.comment;
        ann.meta.isCaseInsensitive = exclusionData.isCaseInsensitive;
        this.addAnnotation(ann, ann.pageNumber);
      }
    });
    this.renderFilterSettings();
  }

  unmarkAnnotationExclusions(exclusionData: RemovedAnnotationExclusion) {
    this.annotations.forEach((ann: Annotation) => {
      if (ann.meta.type === exclusionData.type &&
        this.termsMatch(exclusionData.text, ann.textInDocument, ann.meta.isCaseInsensitive)) {
        const ref = this.annotationHighlightElementMap.get(ann);
        jQuery(ref).remove();
        ann.meta.isExcluded = false;
        this.addAnnotation(ann, ann.pageNumber);
      }
    });
    this.renderFilterSettings();
  }

  matchesCountUpdated({matchesCount, ready = true}) {
    if (this.searchCommand !== 'find') {
      return;
    }
    this.searching = !ready;
    this.matchesCount = matchesCount;
  }

  findControlStateUpdated(event) {
    if (this.showNextFindFeedback) {
      if (event.state === FindState.FOUND) {
        this.showNextFindFeedback = false;
        this.snackBar.open('Found the text in the document.', 'Close', {duration: 5000});
      } else if (event.state === FindState.NOT_FOUND) {
        this.showNextFindFeedback = false;
        this.snackBar.open('Could not find the text in the document.', 'Close', {duration: 5000});
      }
    }
    if (this.searchCommand !== 'findagain' || typeof event.previous === 'undefined') {
      return;
    }
    this.matchesCount = event.matchesCount;
  }

  nullifyMatchesCount() {
    this.matchesCount.total = 0;
    this.matchesCount.current = 0;
  }

  getMultilinedRect() {
    // Find min value for bottom left point and max value for top right point
    // to save the coordinates of the rect that represents multiple lines
    return this.selectedTextCoords.reduce((result, rect) => {
      result[0] = Math.min(result[0], rect[0]);
      result[1] = Math.max(result[1], rect[1]);
      result[2] = Math.max(result[2], rect[2]);
      result[3] = Math.min(result[3], rect[3]);
      return result;
    }, [Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MAX_VALUE]);
  }

}

export interface AnnotationHighlightResult {
  id: string;
  firstAnnotation: Annotation;
  firstPageNumber: number;
  found: number;
}
