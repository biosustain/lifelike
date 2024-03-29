import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';

import { distinctUntilChanged, map, pairwise, startWith, takeUntil } from 'rxjs/operators';
import { isEqual, omit } from 'lodash-es';
import { ReplaySubject, Subject } from 'rxjs';

/**
 * current pdf.js build contains optional chaining
 * which is not supported by typescript
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import * as viewerx from 'pdfjs-dist/legacy/web/pdf_viewer';
import {
  DocumentInitParameters,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from 'pdfjs-dist/types/display/api';
import { PageViewport } from 'pdfjs-dist/types/display/display_utils';
import { PDFProgressData, PDFSource, PDFViewerParams } from './interfaces';
import { createEventBus } from '../utils/event-bus-utils';
import { FindState, RenderTextMode } from '../utils/constants';

const PDFJS = pdfjsLib;
let pdfjsViewer;
const DEFAULT_DOCUMENT_INIT_PARAMETERS: DocumentInitParameters = {};

function isSSR() {
  return typeof window === 'undefined';
}

if (!isSSR()) {
  pdfjsViewer = viewerx;

  DEFAULT_DOCUMENT_INIT_PARAMETERS.verbosity = PDFJS.VerbosityLevel.ERRORS;
}

Object.freeze(DEFAULT_DOCUMENT_INIT_PARAMETERS);

@Component({
  selector: 'app-pdf-viewer-lib',
  template: `
    <div #pdfViewerContainer class="ng2-pdf-viewer-container">
      <div class="pdfViewer"></div>
    </div>
  `,
  styleUrls: ['./pdf-viewer.component.scss'],
})
export class PdfViewerComponent implements OnChanges, OnInit, OnDestroy {
  static CSS_UNITS: number = 96.0 / 72.0;
  static BORDER_WIDTH = 9;

  @Input()
  set cMapsUrl(cMapsUrl: string) {
    this.internalCMapsUrl = cMapsUrl;
  }

  @Input()
  set page(page) {
    page = parseInt(page, 10) || 1;
    const orginalPage = page;

    if (this.internalPdf) {
      page = this.getValidPageNumber(page);
    }

    this.internalPage = page;
    if (orginalPage !== page) {
      this.pageChange.emit(page);
    }
  }

  @Input()
  set renderText(renderText: boolean) {
    this.internalRenderText = renderText;
  }

  @Input()
  set renderTextMode(renderTextMode: RenderTextMode) {
    if (renderTextMode !== undefined) {
      this.internalRenderTextMode = renderTextMode;
    }
  }

  @Input()
  set originalSize(originalSize: boolean) {
    this.internalOriginalSize = originalSize;
  }

  @Input()
  set showAll(value: boolean) {
    this.internalShowAll = value;
  }

  @Input()
  set stickToPage(value: boolean) {
    this.internalStickToPage = value;
  }

  @Input()
  set zoom(value: number) {
    if (value <= 0) {
      return;
    }

    this.internalZoom = value;
  }

  get zoom() {
    return this.internalZoom;
  }

  @Input()
  set rotation(value: number) {
    if (!(typeof value === 'number' && value % 90 === 0)) {
      console.warn('Invalid pages rotation angle.');
      return;
    }

    this.internalRotation = value;
  }

  @Input()
  set externalLinkTarget(value: string) {
    this.internalExternalLinkTarget = value;
  }

  @Input()
  set autoresize(value: boolean) {
    this.internalCanAutoResize = Boolean(value);
  }

  @Input()
  set fitToPage(value: boolean) {
    this.internalFitToPage = Boolean(value);
  }

  @HostBinding('class.selecting') @Input() selecting = false;

  @Input()
  set showBorders(value: boolean) {
    this.internalShowBorders = Boolean(value);
  }

  constructor(private element: ElementRef, private ngZone: NgZone) {
    if (isSSR()) {
      return;
    }

    let pdfWorkerSrc: string;

    if (
      window.hasOwnProperty('pdfWorkerSrc') &&
      typeof (window as any).pdfWorkerSrc === 'string' &&
      (window as any).pdfWorkerSrc
    ) {
      pdfWorkerSrc = (window as any).pdfWorkerSrc;
    } else {
      pdfWorkerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS.version}/pdf.worker.min.js`;
    }

    PDFJS.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  }

  get pdfViewer() {
    return this.getCurrentViewer();
  }

  get pdfFindController() {
    return this.internalShowAll
      ? this.pdfMultiPageFindController
      : this.pdfSinglePageFindController;
  }

  @ViewChild('pdfViewerContainer', { static: false }) pdfViewerContainer;

  private pdfMultiPageViewer;
  private pdfMultiPageLinkService;
  private pdfMultiPageFindController;

  private pdfSinglePageViewer;
  private pdfSinglePageLinkService;
  private pdfSinglePageFindController;

  private internalCMapsUrl =
    typeof PDFJS !== 'undefined' ? `https://unpkg.com/pdfjs-dist@${PDFJS.version}/cmaps/` : null;
  private internalRenderText = true;
  private internalRenderTextMode: RenderTextMode = RenderTextMode.ENHANCED;
  private internalStickToPage = false;
  private internalOriginalSize = true;
  internalPdf: PDFDocumentProxy;
  private internalPage = 1;
  private internalZoom = 1;
  private internalRotation = 0;
  private internalShowAll = true;
  private internalCanAutoResize = true;
  private internalFitToPage = false;
  private internalExternalLinkTarget = 'blank';
  private internalShowBorders = false;
  private lastLoaded: PDFSource;
  private internalLatestScrolledPage: number;

  private resizeTimeout: NodeJS.Timer;
  private pageScrollTimeout: NodeJS.Timer;
  private isInitialized = false;
  private loadingTask: PDFDocumentLoadingTask;

  @Output() afterLoadComplete = new EventEmitter<PDFDocumentProxy>();
  @Output() pageRendered = new EventEmitter<CustomEvent>();
  @Output() textLayerRendered = new EventEmitter<CustomEvent>();
  @Output() matchesCountUpdated = new EventEmitter();
  @Output() findControlStateUpdated = new EventEmitter();
  @Output() errorCallback = new EventEmitter<any>();
  @Output() progressCallback = new EventEmitter<PDFProgressData>();
  @Output() pageChange: EventEmitter<number> = new EventEmitter<number>(true);
  @Input() src: PDFSource;
  @Input() search: string;
  private readonly destroy$ = new Subject<any>();
  private readonly search$ = new ReplaySubject<string>(1);

  static getLinkTarget(type: string) {
    switch (type) {
      case 'blank':
        return PDFJS.LinkTarget.BLANK;
      case 'none':
        return PDFJS.LinkTarget.NONE;
      case 'self':
        return PDFJS.LinkTarget.SELF;
      case 'parent':
        return PDFJS.LinkTarget.PARENT;
      case 'top':
        return PDFJS.LinkTarget.TOP;
    }

    return null;
  }

  setExternalLinkTarget(type: string) {
    const linkTarget = PdfViewerComponent.getLinkTarget(type);
    const { pdfMultiPageLinkService, pdfSinglePageLinkService } = this;

    if (linkTarget !== null) {
      if (pdfMultiPageLinkService) {
        pdfMultiPageLinkService.externalLinkTarget = linkTarget;
      }
      if (pdfSinglePageLinkService) {
        pdfSinglePageLinkService.externalLinkTarget = linkTarget;
      }
    }
  }

  ngOnInit() {
    if (!isSSR()) {
      this.isInitialized = true;
      this.setupMultiPageViewer();
      this.setupSinglePageViewer();
      this.search$.pipe(distinctUntilChanged(), takeUntil(this.destroy$)).subscribe((search) =>
        this.pdfFindController.executeCommand('find', {
          query: search ?? '',
          highlightAll: true,
          phraseSearch: true,
        })
      );
    }
  }

  ngOnDestroy() {
    this.internalPdf?.destroy();
    this.destroy$.next();
  }

  @HostListener('window:resize', [])
  public onPageResize() {
    if (!this.internalCanAutoResize || !this.internalPdf) {
      return;
    }

    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = setTimeout(() => {
      this.updateSize();
    }, 100);
  }

  ngOnChanges({ src, renderText, showAll, page, search }: SimpleChanges) {
    if (isSSR()) {
      return;
    }
    if (src) {
      this.loadPDF();
    } else if (this.internalPdf) {
      if (renderText) {
        this.getCurrentViewer().textLayerMode = this.internalRenderText
          ? this.internalRenderTextMode
          : RenderTextMode.DISABLED;
        this.resetPdfDocument();
      } else if (showAll) {
        this.resetPdfDocument();
      }
      if (page) {
        if (page.currentValue === this.internalLatestScrolledPage) {
          return;
        }

        // New form of page changing: The viewer will now jump to the specified page when it is changed.
        // This behavior is introducedby using the PDFSinglePageViewer
        this.getCurrentViewer().scrollPageIntoView({ pageNumber: this.internalPage });
      }

      this.update();
    }
    if (search) {
      this.search$.next(search.currentValue);
    }
  }

  public searchPrev() {
    this.pdfFindController.executeCommand('findagain', {
      query: this.search,
      highlightAll: true,
      phraseSearch: true,
      findPrevious: true,
    });
  }

  public searchNext() {
    this.pdfFindController.executeCommand('findagain', {
      query: this.search,
      highlightAll: true,
      phraseSearch: true,
      findPrevious: false,
    });
  }

  public convertCoordinates(pageNum: number, rect: number[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.internalPdf.getPage(pageNum).then((page: PDFPageProxy) => {
        const rotation = this.internalRotation || page.rotate;
        const viewPort: PageViewport = (page as any).getViewport({
          scale: this.internalZoom,
          rotation,
        });

        const bounds = viewPort.convertToViewportRectangle(rect);
        const left = Math.min(bounds[0], bounds[2]);
        const top = Math.min(bounds[1], bounds[3]);
        const width = Math.abs(bounds[0] - bounds[2]);
        const height = Math.abs(bounds[1] - bounds[3]);
        resolve({
          left,
          top,
          width,
          height,
        });
      });
    });
  }

  public getCurrentPageNumber() {
    const viewer = this.getCurrentViewer();
    return viewer.currentPageNumber;
  }

  public updateSize() {
    const currentViewer = this.getCurrentViewer();
    return this.internalPdf.getPage(currentViewer.currentPageNumber).then((page: PDFPageProxy) => {
      const rotation = this.internalRotation || page.rotate;
      const viewportWidth =
        (page as any).getViewport({
          scale: this.internalZoom,
          rotation,
        }).width * PdfViewerComponent.CSS_UNITS;
      let scale = this.internalZoom;
      let stickToPage = true;

      // Scale the document when it shouldn't be in original size or doesn't fit into the viewport
      if (
        !this.internalOriginalSize ||
        (this.internalFitToPage &&
          viewportWidth > this.pdfViewerContainer.nativeElement.clientWidth)
      ) {
        scale = this.getScale((page as any).getViewport({ scale: 1, rotation }).width);
        stickToPage = !this.internalStickToPage;
      }

      currentViewer._setScale(scale, stickToPage);
    });
  }

  public clear() {
    if (this.loadingTask && !this.loadingTask.destroyed) {
      this.loadingTask.destroy();
    }

    if (this.internalPdf) {
      this.internalPdf.destroy();
      this.internalPdf = null;
      this.pdfMultiPageViewer.setDocument(null);
      this.pdfSinglePageViewer.setDocument(null);

      this.pdfMultiPageLinkService.setDocument(null, null);
      this.pdfSinglePageLinkService.setDocument(null, null);
    }
  }

  updatefindmatchescount({ source, matchesCount, rawQuery = true }) {
    return this.matchesCountUpdated.emit({
      matchesCount,
      searching:
        Boolean(rawQuery) &&
        this.pdfMultiPageLinkService?.pagesCount !== source?.pageMatchesLength?.length,
    });
  }

  private setupMultiPageViewer() {
    pdfjsViewer.TextLayerBuilder.disableTextLayer = this.internalRenderText
      ? this.internalRenderTextMode
      : RenderTextMode.DISABLED;

    this.setExternalLinkTarget(this.internalExternalLinkTarget);

    const eventBus = createEventBus(pdfjsViewer);

    eventBus.on('pagechanging', (e) => {
      if (this.pageScrollTimeout) {
        clearTimeout(this.pageScrollTimeout);
      }

      this.pageScrollTimeout = setTimeout(() => {
        this.internalLatestScrolledPage = e.pageNumber;
        this.pageChange.emit(e.pageNumber);
      }, 100);
    });

    eventBus.on('pagesinit', (e) => {
      this.afterLoadComplete.emit(this.internalPdf);
    });

    eventBus.on('pagerendered', (e) => {
      this.pageRendered.emit(e);
    });

    eventBus.on('textlayerrendered', (e) => {
      this.textLayerRendered.emit(e);
    });

    /*
    This event id fired when total number of matches has changed.
     */
    eventBus.on('updatefindmatchescount', (event) => this.updatefindmatchescount(event));

    /*
    This event id fired when:
      + navigate to next/prev match
      + search state change ( FindState; fires only for first match )
     */
    eventBus.on('updatefindcontrolstate', (event) => {
      this.findControlStateUpdated.emit(omit(event, 'source'));
      this.updatefindmatchescount(event);
    });

    this.pdfMultiPageLinkService = new pdfjsViewer.PDFLinkService({
      eventBus,
      externalLinkTarget: PDFJS.LinkTarget.BLANK,
    });
    this.pdfMultiPageFindController = new pdfjsViewer.PDFFindController({
      linkService: this.pdfMultiPageLinkService,
      eventBus,
    });

    const pdfOptions: PDFViewerParams = {
      eventBus,
      container: this.element.nativeElement.querySelector('div'),
      removePageBorders: !this.internalShowBorders,
      linkService: this.pdfMultiPageLinkService,
      textLayerMode: this.internalRenderText
        ? this.internalRenderTextMode
        : RenderTextMode.DISABLED,
      findController: this.pdfMultiPageFindController,
    };

    this.ngZone.runOutsideAngular(() => {
      this.pdfMultiPageViewer = new pdfjsViewer.PDFViewer(pdfOptions);
      this.pdfMultiPageLinkService.setViewer(this.pdfMultiPageViewer);
    });
  }

  private setupSinglePageViewer() {
    pdfjsViewer.TextLayerBuilder.enhanceTextSelection = !this.internalRenderText;

    this.setExternalLinkTarget(this.internalExternalLinkTarget);

    const eventBus = createEventBus(pdfjsViewer);

    eventBus.on('pagechanging', (e) => {
      if (e.pageNumber !== this.internalPage) {
        this.page = e.pageNumber;
      }
    });

    eventBus.on('pagesinit', (e) => {
      this.afterLoadComplete.emit(this.internalPdf);
    });

    eventBus.on('pagerendered', (e) => {
      this.pageRendered.emit(e);
    });

    eventBus.on('textlayerrendered', (e) => {
      this.textLayerRendered.emit(e);
    });

    /*
    This event id fired when total number of matches has changed.
     */
    eventBus.on('updatefindmatchescount', (e) => this.updatefindmatchescount(e));

    /*
    This event id fired when:
      + navigate to next/prev match
      + search state change ( FindState; fires only for first match )
     */
    eventBus.on('updatefindcontrolstate', (e) => this.findControlStateUpdated.emit(e));

    this.pdfSinglePageLinkService = new pdfjsViewer.PDFLinkService({
      eventBus,
      externalLinkTarget: PDFJS.LinkTarget.BLANK,
    });
    this.pdfSinglePageFindController = new pdfjsViewer.PDFFindController({
      linkService: this.pdfSinglePageLinkService,
      eventBus,
    });

    const pdfOptions: PDFViewerParams = {
      eventBus,
      container: this.element.nativeElement.querySelector('div'),
      removePageBorders: !this.internalShowBorders,
      linkService: this.pdfSinglePageLinkService,
      textLayerMode: this.internalRenderText
        ? this.internalRenderTextMode
        : RenderTextMode.DISABLED,
      findController: this.pdfSinglePageFindController,
    };

    this.pdfSinglePageViewer = new pdfjsViewer.PDFSinglePageViewer(pdfOptions);
    this.pdfSinglePageLinkService.setViewer(this.pdfSinglePageViewer);

    this.pdfSinglePageViewer._currentPageNumber = this.internalPage;
  }

  private getValidPageNumber(page: number): number {
    if (page < 1) {
      return 1;
    }

    if (page > this.internalPdf.numPages) {
      return this.internalPdf.numPages;
    }

    return page;
  }

  private getDocumentParams(): DocumentInitParameters {
    const srcType = typeof this.src;

    const params: DocumentInitParameters = Object.assign({}, DEFAULT_DOCUMENT_INIT_PARAMETERS);
    if (srcType === 'string') {
      params.url = this.src as string;
    } else if (srcType === 'object') {
      if ((this.src as Uint8Array).byteLength !== undefined) {
        params.data = this.src as Uint8Array;
      } else {
        Object.assign(params, this.src);
      }
    }

    if (this.internalCMapsUrl) {
      Object.assign(params, {
        cMapUrl: this.internalCMapsUrl,
        cMapPacked: true,
      });
    }

    return params;
  }

  private loadPDF() {
    if (!this.src) {
      return;
    }

    if (this.lastLoaded === this.src) {
      this.update();
      return;
    }

    this.clear();

    this.ngZone.runOutsideAngular(() => {
      this.loadingTask = PDFJS.getDocument(this.getDocumentParams());
    });

    this.loadingTask.onProgress = (progressData: PDFProgressData) => {
      this.progressCallback.emit(progressData);
    };

    const src = this.src;
    this.loadingTask.promise.then((pdf: PDFDocumentProxy) => {
      this.internalPdf = pdf;
      this.lastLoaded = src;

      if (!this.pdfMultiPageViewer) {
        this.setupMultiPageViewer();
        this.setupSinglePageViewer();
      }

      this.resetPdfDocument();

      return this.update();
    }, this.errorCallback.emit);
  }

  private update() {
    this.page = this.internalPage;

    return this.render();
  }

  private render() {
    this.internalPage = this.getValidPageNumber(this.internalPage);
    const currentViewer = this.getCurrentViewer();

    if (this.internalRotation !== 0 || currentViewer.pagesRotation !== this.internalRotation) {
      currentViewer.pagesRotation = this.internalRotation;
    }

    if (this.internalStickToPage) {
      currentViewer.currentPageNumber = this.internalPage;
    }

    return this.updateSize();
  }

  private getScale(viewportWidth: number) {
    const pdfContainerWidth =
      this.pdfViewerContainer.nativeElement.clientWidth -
      (this.internalShowBorders ? 2 * PdfViewerComponent.BORDER_WIDTH : 0);

    if (pdfContainerWidth === 0 || viewportWidth === 0) {
      return 1;
    }

    return (this.internalZoom * (pdfContainerWidth / viewportWidth)) / PdfViewerComponent.CSS_UNITS;
  }

  private getCurrentViewer() {
    return this.internalShowAll ? this.pdfMultiPageViewer : this.pdfSinglePageViewer;
  }

  private resetPdfDocument() {
    if (this.internalShowAll) {
      this.pdfSinglePageViewer.setDocument(null);
      this.pdfSinglePageLinkService.setDocument(null);

      this.pdfMultiPageViewer.setDocument(this.internalPdf);
      this.pdfMultiPageLinkService.setDocument(this.internalPdf, null);
    } else {
      this.pdfMultiPageViewer.setDocument(null);
      this.pdfMultiPageLinkService.setDocument(null);

      this.pdfSinglePageViewer.setDocument(this.internalPdf);
      this.pdfSinglePageLinkService.setDocument(this.internalPdf, null);
    }
  }
}
