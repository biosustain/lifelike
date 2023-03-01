import {
  ApplicationRef,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Injector,
  Input,
  NgZone,
  OnDestroy,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
  AfterViewInit,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ComponentPortal, DomPortalOutlet } from '@angular/cdk/portal';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { defer, forEach, isEqual, uniqueId, kebabCase, first as _first, isEmpty, escape, isNil } from 'lodash-es';
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  combineLatest,
} from 'rxjs';
import {
  distinctUntilChanged,
  switchMap,
  tap,
  first,
  map,
  startWith,
  pairwise,
  filter,
  takeUntil,
} from 'rxjs/operators';

import { DatabaseLink, ENTITY_TYPE_MAP, EntityType, ENTITY_TYPES } from 'app/shared/annotation-types';
import { LINKS } from 'app/shared/links';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { openModal } from 'app/shared/utils/modals';
import { IS_MAC } from 'app/shared/utils/platform';
import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { composeInternalLink } from 'app/shared/workspace-manager';
import { isNotEmpty } from 'app/shared/utils';
import { AppURL } from 'app/shared/url';

import { PDFDocumentProxy } from 'pdfjs-dist/types/display/api';
import { Annotation, Location, Meta, Rect } from './annotation-type';
import { AnnotationEditDialogComponent } from './components/annotation-edit-dialog.component';
import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';
import { FindState, RenderTextMode } from './utils/constants';
import {
  PDFPageRenderEvent,
  PDFPageView,
  PDFProgressData,
  PDFSource,
  ScrollDestination,
  TextLayerBuilder,
} from './pdf-viewer/interfaces';
import { AnnotationToolbarComponent } from './components/annotation-toolbar.component';
import { AnnotationLayerComponent } from './components/annotation-layer/annotation-layer.component';
import { PDFAnnotationService } from './services/pdf-annotation.service';
import { PDFSearchService } from './services/pdf-search.service';

// PDF.js defaults
// https://github.com/mozilla/pdf.js/blob/5e4b3d13ebc6eb2453f0cad12f33964e2d4fc6fc/web/pdf_find_controller.js#L32:L33
const MATCH_SCROLL_OFFSET_TOP = -50; // px
const MATCH_SCROLL_OFFSET_LEFT = -400; // px

@Component({
  selector: 'app-lib-pdf-viewer-lib',
  templateUrl: './pdf-viewer-lib.component.html',
  styleUrls: ['./pdf-viewer-lib.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PdfViewerLibComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
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
    protected readonly pdfAnnService: PDFAnnotationService,
    protected readonly clipboard: ClipboardService,
    readonly search: PDFSearchService
  ) {
    this.search.query$
      .pipe(
        filter((query) => isNotEmpty(query)),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.pdfAnnService.highlightAllAnnotations(null));
  }

  @ViewChild('container', { static: true }) containerRef: ElementRef;

  @Input() pdfSrc: PDFSource;
  // TODO: All observables should be readonly
  @Input() goToPosition$: Subject<Location>;
  @Input() debugMode: boolean;
  @Input() showExcludedAnnotations: boolean;
  @Input() entityTypeVisibilityMap;
  renderTextMode: RenderTextMode = RenderTextMode.ENHANCED;

  @Output() loadCompleted = new EventEmitter();
  @Output() annotationDragStart = new EventEmitter<AnnotationDragEvent>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() goToPositionVisit = new EventEmitter<Location>();

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
  goToPositionVisitAfterFind: Location | undefined = null;

  pageRef: { [idx: number]: PDFPageView } = {};
  index: any;

  allText: string;
  selectedText: string[];
  selectedTextCoords: Rect[];
  currentPage: number;
  selectedElements: HTMLElement[] = [];

  dragAndDropOriginCoord;
  dragAndDropOriginHoverCount;
  dragAndDropDestinationCoord;
  dragAndDropDestinationHoverCount;

  pdfViewerId = uniqueId();

  private firstAnnotationRange: Range | undefined;
  private requestAnimationFrameId: number | undefined;

  @ViewChild(PdfViewerComponent, { static: false })
  private pdfComponent: PdfViewerComponent;

  selection: Selection;

  ranges;

  annotationToolbarPortal = new ComponentPortal(AnnotationToolbarComponent);
  annotationToolbarRef;
  /**
   * Flag used to distinguish deselection and selection end
   * based on selectionchange and mouseup events
   */
  selecting = false;
  usedTextLayerPortalOutlet;

  selectionDragContainer;

  textLayerPortalOutlets: Map<number, DomPortalOutlet> = new Map();
  annotationLayerComponentRef: Map<number, ComponentRef<AnnotationLayerComponent>> = new Map();
  private searchCommand: string;

  readonly destroy$ = new Subject();

  matchesCountUpdated(matchesCountUpdate) {
    return this.search.resultSummary$.next(matchesCountUpdate);
  }

  findControlStateUpdated(event) {
    if (this.goToPositionVisitAfterFind != null) {
      this.goToPositionVisit.emit(this.goToPositionVisitAfterFind);
      this.goToPositionVisitAfterFind = null;
    }
    if (this.showNextFindFeedback) {
      if (event.state === FindState.FOUND) {
        this.showNextFindFeedback = false;
        this.snackBar.open('Found the text in the document.', 'Close', { duration: 5000 });
      } else if (event.state === FindState.NOT_FOUND) {
        this.showNextFindFeedback = false;
        this.snackBar.open('Could not find the text in the document.', 'Close', { duration: 5000 });
      }
    }
  }

  ngOnInit() {
    this.goToPosition$.pipe(takeUntil(this.destroy$)).subscribe((sub) => {
      if (!this.isLoadCompleted && sub) {
        // Pdf viewer is not ready to go to a position
        return;
      }
      if (sub != null) {
        if (sub.pageNumber != null) {
          this.addHighlightItem(sub.pageNumber, sub.rect);
          this.goToPositionVisit.emit(sub);
        } else if (sub.jumpText != null) {
          const simplified = sub.jumpText.replace(/[\s\r\n]/g, ' ').trim();
          const words = simplified.split(/ /g);
          const prefixQuery = words.splice(0, 4).join(' ');
          this.showNextFindFeedback = true;
          this.search.query$.next(prefixQuery);
          this.goToPositionVisitAfterFind = sub;
        } else {
          this.goToPositionVisit.emit(sub);
        }
      }
    });
  }

  ngOnChanges({ showExcludedAnnotations, entityTypeVisibilityMap }: SimpleChanges) {
    if (showExcludedAnnotations) {
      this.elementRef.nativeElement.style.setProperty(
        '--show-excluded',
        showExcludedAnnotations.currentValue ? '' : 'none'
      );
    }
    if (entityTypeVisibilityMap) {
      [...entityTypeVisibilityMap.currentValue.entries()].forEach(([id, state]) => {
        this.elementRef.nativeElement.style.setProperty('--' + kebabCase(id), state ? '' : 'none');
      });
    }
  }

  ngAfterViewInit() {
    this.pdfAnnService.highlightedAnnotation$
      .pipe(takeUntil(this.destroy$))
      .subscribe((highlightedAnnotation) => {
        if (highlightedAnnotation) {
          this.addHighlightItem(
            highlightedAnnotation.pageNumber,
            _first(highlightedAnnotation.rects)
          );
        }
        this.search.query$.next(null);
      });
    this.search.next$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.pdfComponent.searchNext());
    this.search.prev$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.pdfComponent.searchPrev());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.requestAnimationFrameId);

    this.destroy$.next();

    this.textLayerPortalOutlets.forEach((p) => p.dispose());
  }

  @HostListener('window:mouseup', ['$event'])
  mouseUp(event) {
    if (this.selecting) {
      this.selecting = false;
      this.selectionEnd(event);
    }
  }

  detachFromUsedTextLayerPortalOutlet() {
    if (this.usedTextLayerPortalOutlet && this.usedTextLayerPortalOutlet.hasAttached()) {
      this.usedTextLayerPortalOutlet.detach();
    }
  }

  @HostListener('document:selectstart', ['$event'])
  selectstart(event: Event) {
    this.deselect();
    this.selection = null;
    this.firstAnnotationRange = null;
    // taking parent as to not start with Text node which does not have 'closest' method
    const pageNumber = this.getClosestPageNumber(event.target as Node);
    // not selecting outside pdf viewer
    if (pageNumber > -1) {
      this.selecting = true;
      const textLayerPortalOutlet = this.textLayerPortalOutlets.get(pageNumber);
      this.usedTextLayerPortalOutlet = textLayerPortalOutlet;
      this.annotationToolbarRef = textLayerPortalOutlet.attach(this.annotationToolbarPortal);
      this.annotationToolbarRef.instance.pageRef = this.pageRef;
      this.annotationToolbarRef.instance.containerRef = this.containerRef;
    }
  }

  deselect() {
    if (IS_MAC) {
      this.removeSelectionDragContainer();
    }
    this.detachFromUsedTextLayerPortalOutlet();
  }

  removeSelectionDragContainer() {
    if (this.selectionDragContainer) {
      this.selectionDragContainer.remove();
      this.selectionDragContainer = undefined;
    }
  }

  @HostListener('document:selectionchange', ['$event'])
  selectionChange(event: Event) {
    if (this.selecting) {
      const selection = window.getSelection();
      const ranges = this.getValidSelectionRanges(selection);
      if (ranges.length) {
        this.selection = selection;
        this.ranges = ranges;
        this.firstAnnotationRange = ranges[0];
        this.placeAnnotationToolbar(ranges[0]);
      } else {
        this.selection = null;
        this.firstAnnotationRange = null;
      }
    } else {
      this.deselect();
    }
  }

  /**
   * Clone elements and reposition them to match originals
   */
  cloneRangeContents(range: Range) {
    const { startOffset, endOffset } = range;
    const rangeDocumentFragment = range.cloneContents();
    // if selection is within singular span and not empty
    if (!rangeDocumentFragment.children.length && !range.collapsed) {
      const clonedElement = range.commonAncestorContainer.parentElement.cloneNode(
        true
      ) as HTMLElement;
      clonedElement.innerText = clonedElement.innerText.slice(startOffset, endOffset);
      rangeDocumentFragment.appendChild(clonedElement);
    }
    // drop padding and reposition accordingly
    forEach(rangeDocumentFragment.children, (node: HTMLElement) => {
      // scrap translate transformations which balances padding misplacement
      node.style.transform = node.style.transform.replace(/ ?translate.{0,2}\(.*?\)/gi, '');
    });
    // adjust first container position if contains fraction of text
    if (startOffset) {
      const firstClonedElement = rangeDocumentFragment.firstElementChild as HTMLElement;
      if (firstClonedElement) {
        // estimation based on percentage of ignored letters
        const offsetOfStart = startOffset / firstClonedElement.innerText.length;
        firstClonedElement.style.transform += ` translateX(${offsetOfStart * 100}%)`;
      }
    }
    return rangeDocumentFragment;
  }

  /** Implement natively missing selection end event
   *  Although it does not exist in Selection API it
   *  can be easily added to fire on first mouseup
   *  after selection start.
   */
  selectionEnd(event: Event) {
    if (this.firstAnnotationRange) {
      if (IS_MAC) {
        const textLayer = this.getClosestTextLayer(
          this.firstAnnotationRange.commonAncestorContainer
        );
        // if it is not multiple page selection (not-supported - still would work just without behaviour adjustment for mac)
        if (textLayer) {
          this.removeSelectionDragContainer();
          // Create transparent not selectable overlay with copy of selected nodes
          const drag = document.createElement('div');
          drag.draggable = true;
          drag.classList.add('selection');
          drag.appendChild(this.cloneRangeContents(this.firstAnnotationRange));
          textLayer.appendChild(drag);
          this.selectionDragContainer = drag;
        }
      }
    } else {
      this.deselect();
    }
    // allow interaction with toolbar after selection to prevent flickering
    this.annotationToolbarRef.instance.active = true;
  }

  /**
   * Wrapper on event.dataTransfer.setDragImage to adjust drag image styling
   * @param node - to use as drag image
   * @param event - event to decorate
   */
  setDragImage(node, event) {
    const draggedElementRef = IS_MAC
      ? this.selectionDragContainer
      : this.getClosestTextLayer(this.firstAnnotationRange.commonAncestorContainer);

    draggedElementRef.classList.add('dragged');
    // event.dataTransfer.setDragImage runs in async after dragstart but does not return the handle
    // styling needs to be reversed after current async stack is emptied
    defer(() => draggedElementRef.classList.remove('dragged'));
  }

  @HostListener('dragstart', ['$event'])
  dragStart(event: DragEvent) {
    const { selection, ranges } = this;
    this.setDragImage(this.selectionDragContainer, event);
    const currentPage = this.detectPageFromRanges(ranges);
    if (ranges.length && currentPage != null) {
      this.annotationDragStart.emit({
        event,
        meta: {
          allText: selection.toString(),
          type: 'link',
        },
        location: {
          pageNumber: currentPage,
          rect: this.toPDFRelativeRects(
            currentPage,
            ranges.map((range) => range.getBoundingClientRect())
          )[0],
        },
      });

      event.stopPropagation();
    }
  }

  @HostListener('dragend', ['$event'])
  dragEnd(event: DragEvent) {
    // TODO: This causes an error on drop of (custom?) annotation due to the undefined this.firstAnnotationRange
    const page = this.getClosestTextLayer(this.firstAnnotationRange.commonAncestorContainer);
    page.classList.remove('dragged');
  }

  // endregion

  resetSelection() {
    this.selectedText = [];
    this.selectedTextCoords = [];
    this.allText = '';
    this.selectedElements = [];
  }

  openAnnotationPanel() {
    const text = window.getSelection().toString().trim();
    const selection = window.getSelection();
    const ranges = this.getValidSelectionRanges(selection);
    const currentPage = this.detectPageFromRanges(ranges);

    if (ranges.length && currentPage != null) {
      const dialogRef = openModal(this.modalService, AnnotationEditDialogComponent);
      dialogRef.componentInstance.allText = text;
      dialogRef.componentInstance.keywords = [text];
      dialogRef.componentInstance.coords = this.toPDFRelativeRects(
        currentPage,
        ranges.map((range) => range.getBoundingClientRect())
      );
      dialogRef.componentInstance.pageNumber = currentPage;
      dialogRef.result.then(
        (annotation) => {
          this.pdfAnnService.annotationCreated(annotation);
          window.getSelection().empty();
        },
        () => {}
      );
    } else {
      this.errorHandler.showError(
        new Error('openAnnotationPanel(): failed to get selection or page on PDF viewer')
      );
    }
  }

  /**
   * Get a list of valid selections within the text.
   *
   * @param selection the selection to parse
   */
  private getValidSelectionRanges(selection: Selection): Range[] {
    const ranges: Range[] = [];
    const container = this.elementRef.nativeElement;
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (
        !range.collapsed &&
        (container.contains(range.startContainer) || container.contains(range.endContainer))
      ) {
        ranges.push(range);
      }
    }
    return ranges;
  }

  /** Get the closest DOM element by selector
   * This helper method allows for search starting on Node
   * not only on Element (extending Element.closest() capabilities)
   */
  getClosest(node: Node, selector: string) {
    // fail fast - don't search outside of view
    if (!node || node === this.elementRef.nativeElement) {
      return null;
    }
    if (node instanceof Element) {
      return node.closest(selector);
    }
    // if there is no parent `parentElement` will return null
    // if we use `parentNode` here it can cause infinite loop
    // for instance on node = document
    return this.getClosest(node.parentElement, selector);
  }

  /**
   * Helper to have mapping by '.page' declared only once
   */
  getClosestPage(node: Node) {
    return this.getClosest(node, '.page');
  }

  /**
   * Helper to have mapping by '.page' declared only once
   */
  getClosestPageNumber(node: Node): number {
    const page = this.getClosestPage(node);
    const pageView = Object.entries(this.pageRef).find(([pageNumber, p]) => p.div === page);
    return pageView ? parseInt(pageView[0], 10) : -1;
  }

  /**
   * Helper to have mapping by '.textLayer' declared only once
   */
  getClosestTextLayer(node: Node) {
    return this.getClosest(node, '.textLayer');
  }

  /**
   * Position the annotation toolbar.
   */
  private placeAnnotationToolbar(range: Range) {
    if (range != null) {
      const rangeRects = range.getClientRects();
      if (rangeRects.length) {
        const page = this.getClosestPage(range.startContainer);
        const containerRect = page.getBoundingClientRect();
        const rect = rangeRects.item(0);
        this.annotationToolbarRef.instance.position = {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
        };
      }
    }
  }

  isSelectionAnnotatable(): boolean {
    const text = window.getSelection().toString();
    return text.trim() !== '';
  }

  copySelectionText() {
    navigator.clipboard.writeText(window.getSelection().toString()).then(
      () => {
        this.snackBar.open('Copied text to clipboard.', null, {
          duration: 2000,
        });
      },
      () => {
        this.snackBar.open('Failed to copy text.', null, {
          duration: 2000,
        });
      }
    );
  }

  removeAnnotationExclusion(annExclusion) {
    return this.pdfAnnService.annotationExclusionRemoved(annExclusion);
  }

  clearSelection() {
    const sel = window.getSelection();
    sel.removeAllRanges();
  }

  /**
   * Set custom path to pdf worker
   */
  setCustomWorkerPath() {
    (window as any).pdfWorkerSrc = '/lib/pdfjs-dist/legacy/build/pdf.worker.js';
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

    this.isLoadCompleted = true;

    this.loadCompleted.emit(true);
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
    this.isLoadCompleted = !!this.isLoaded;
    this.error = null; // clear error
  }

  getInt(value: number): number {
    return Math.round(value);
  }

  /**
   * Scroll view
   */
  scrollToPage(pageNum: number, highlightRect?: number[]) {
    const dest = { pageNumber: pageNum } as ScrollDestination;
    // Alike PDF.js search navigation
    // https://github.com/mozilla/pdf.js/blob/5e4b3d13ebc6eb2453f0cad12f33964e2d4fc6fc/web/pdf_find_controller.js#L502:L522
    if (highlightRect.length) {
      const [left, bottom, right, top] = highlightRect;
      dest.destArray = [
        null,
        { name: 'XYZ' },
        left - MATCH_SCROLL_OFFSET_LEFT,
        top - MATCH_SCROLL_OFFSET_TOP,
        null,
      ];
    }
    this.pdfComponent.pdfViewer.scrollPageIntoView(dest);
  }

  addHighlightItem(pageNum: number, highlightRect: number[]) {
    const annotationLayerComponentRef = this.annotationLayerComponentRef.get(pageNum);
    if (!annotationLayerComponentRef) {
      this.scrollToPage(pageNum, highlightRect);
      this.pendingHighlights[pageNum] = highlightRect;
      return;
    }
    annotationLayerComponentRef.instance.addHighlightItem(highlightRect);
    this.scrollToPage(pageNum, highlightRect);
  }

  createTextLayerPortalOutlet({ pageNumber, textLayerDiv }: TextLayerBuilder) {
    const portalOutlet = new DomPortalOutlet(textLayerDiv, this.cfr, this.appRef, this.injector);
    this.textLayerPortalOutlets.set(pageNumber, portalOutlet);
    return portalOutlet;
  }

  /**
   * Page rendered callback, which is called when a page is rendered (called multiple times)
   */
  pageRendered({ pageNumber, source }: PDFPageRenderEvent) {
    this.allPages = this.pdf.numPages;
    this.currentRenderedPage = pageNumber;
    this.pageRef[pageNumber] = source;
    const portalOutlet = this.createTextLayerPortalOutlet(source.textLayer);
    const annotationLayerComponentRef = portalOutlet.attachComponentPortal(
      new ComponentPortal(AnnotationLayerComponent)
    );
    annotationLayerComponentRef.instance.dragStart
      .pipe(
        takeUntil(this.destroy$),
        map(({ rect, ...rest }) => ({
          ...rest,
          location: {
            rect,
            pageNumber,
          },
        }))
      )
      .subscribe(this.annotationDragStart);
    annotationLayerComponentRef.instance.pdfPageView = source;
    this.annotationLayerComponentRef.set(pageNumber, annotationLayerComponentRef);
  }

  @HostListener('keydown.control.c')
  @HostListener('keydown.meta.c')
  copySelectedText() {
    if (!this.selection) {
      return;
    }
    this.clipboard.copy(this.selection.toString(), { success: 'It has been copied to clipboard' });
  }

  getMultilinedRect() {
    // Find min value for bottom left point and max value for top right point
    // to save the coordinates of the rect that represents multiple lines
    return this.selectedTextCoords.reduce(
      (result, rect) => {
        result[0] = Math.min(result[0], rect[0]);
        result[1] = Math.max(result[1], rect[1]);
        result[2] = Math.max(result[2], rect[2]);
        result[3] = Math.min(result[3], rect[3]);
        return result;
      },
      [Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MAX_VALUE]
    );
  }

  private detectPageFromRanges(ranges: Range[]): number | undefined {
    for (const range of ranges) {
      const element: Node = range.commonAncestorContainer;
      const pageElement = this.getClosestPage(element);
      if (pageElement) {
        return parseInt(pageElement.getAttribute('data-page-number'), 10);
      }
    }
    return null;
  }

  private toPDFRelativeRects(pageNumber: number, rects: (ClientRect | DOMRect)[]): Rect[] {
    const pdfPageView = this.pageRef[pageNumber];
    const viewport = pdfPageView.viewport;
    const pageRect = pdfPageView.canvas.getClientRects()[0];
    const ret: Rect[] = [];
    for (const r of rects) {
      ret.push(
        viewport
          .convertToPdfPoint(r.left - pageRect.left, r.top - pageRect.top)
          .concat(viewport.convertToPdfPoint(r.right - pageRect.left, r.bottom - pageRect.top))
      );
    }
    return ret;
  }
}

export interface AnnotationHighlightResult {
  id: string;
  firstAnnotation: Annotation;
  firstPageNumber: number;
  found: number;
  readonly index$: BehaviorSubject<number>;
}

export interface AnnotationLayerDragEvent {
  event: DragEvent;
  meta: Meta;
  rect: Rect;
}

export interface AnnotationDragEvent {
  event: DragEvent;
  meta: Meta;
  location: Location;
}
