import { AfterViewInit, Component, EventEmitter, HostListener, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Observable, Subject, Subscription  } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Annotation, Location, Meta } from './annotation-type';
import { PDFDocumentProxy, PDFProgressData, PDFSource } from './pdf-viewer/pdf-viewer.module';
import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';
import { MatDialog } from '@angular/material/dialog';
import { PDFPageViewport } from 'pdfjs-dist';
import { AnnotationPanelComponent } from './annotation-panel/annotation-panel.component';
import { annotationTypes } from 'app/shared/annotation-styles';

declare var jQuery: any;

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'lib-pdf-viewer-lib',
  templateUrl: './pdf-viewer-lib.component.html',
  styleUrls: ['./pdf-viewer-lib.component.scss']
})
export class PdfViewerLibComponent implements OnInit, OnDestroy, AfterViewInit {

  @Input() searchChanged: Subject<string>;
  private searchChangedSub: Subscription;
  @Input() pdfSrc: string | PDFSource | ArrayBuffer;
  @Input() annotations: Annotation[];
  @Input() dropAreaIdentifier: string;
  @Input() handleDropArea: boolean;
  @Input() goToPosition: Subject<Location>;
  @Input() debugMode: boolean;
  @Input() entityTypeVisibilityMap: Map<string, boolean> = new Map();
  @Input() filterChanges: Observable<void>;
  private filterChangeSubscription: Subscription;

  @Input()
  set addedAnnotation(annotation: Annotation) {
    if (annotation) {
      this.addAnnotation(annotation, annotation.pageNumber, true);
      this.annotations.push(annotation);
      this.updateAnnotationVisibility(annotation);
    }
  }

  @Output() loadCompleted = new EventEmitter();
  @Output() dropEvents = new EventEmitter();
  // tslint:disable
  @Output('custom-annotation-created') annotationCreated = new EventEmitter();

  /**
   * Stores a mapping of annotations to the HTML elements that are used to show it.
   */
  private readonly annotationHighlightElementMap: Map<Annotation, HTMLElement[]>  = new Map();

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

  pageRef = {};
  index: any;

  allText: string;
  selectedText: string[];
  selectedTextCoords: any[];
  currentPage: number;
  mouseDownClientX: number;
  mouseDownClientY: number;
  dragThreshold = 5;
  isSelectionLink = false;
  selectedElements: HTMLElement[] = [];

  opacity = 0.3;

  @ViewChild(PdfViewerComponent, {static: false})
  private pdfComponent: PdfViewerComponent;

  constructor(private dialog: MatDialog, private zone: NgZone) {

    (window as any).copySelectedText = () => {
      (window as any).pdfViewerRef.zone.run(() => {
        (window as any).pdfViewerRef.copySelectedText();
      });
    }
    (window as any).openAnnotationPanel = () => {
      (window as any).pdfViewerRef.zone.run(() => {
        (window as any).pdfViewerRef.componentFn();
      });
    };
    (window as any).openLinkPanel = this.openAddLinkPanel.bind(this);
    (window as any).pdfViewerRef = {
      zone: this.zone,
      componentFn: () => this.openAnnotationPanel(),
      copySelectedText: () => this.copySelectedText(),
      component: this
    };
  }

  ngOnInit() {
    this.goToPosition.subscribe((sub) => {
      if (!this.isLoadCompleted && sub) {
        // Pdf viewer is not ready to go to a position
        return;
      }
      if (sub) {
        this.scrollToPage(sub.pageNumber, sub.rect);
      }
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
      debounceTime(250)).subscribe((query) => {
      this.searchQueryChanged(query);
    });
  }

  ngAfterViewInit(): void {
    const dropAreaIdentifier = this.dropAreaIdentifier;
    const that = this;
    jQuery(dropAreaIdentifier).droppable({
      accept: '.frictionless-annotation,.system-annotation',
      drop(event, ui) {
        if (that.isSelectionLink) {
          const meta: Meta = JSON.parse(ui.draggable[0].getAttribute('meta'));
          meta.type = 'Links';
          ui.draggable[0].setAttribute('meta', JSON.stringify(meta));
        }

        that.dropEvents.emit({
          event,
          ui
        });

        if (this.handleDropArea) {
          const droppable = jQuery(this);
          const draggable = ui.draggable;
          const clone = draggable.clone();
          // Move draggable into droppable
          jQuery(dropAreaIdentifier).append(clone);
          const $newPosX = ui.offset.left - jQuery(this).offset().left;
          const $newPosY = ui.offset.top - jQuery(this).offset().top;
          clone.css({position: 'relative', top: Number($newPosY), left: Number($newPosX)});
          clone.removeClass('highlight');
        }
        that.deleteFrictionless();
      }
    });

    this.pdfComponent.pdfViewerContainer.nativeElement.addEventListener('mousedown', this.mouseDown);
    this.pdfComponent.pdfViewerContainer.nativeElement.addEventListener('mouseup', this.mouseUp);
  }

  ngOnDestroy(): void {
    this.pdfComponent.pdfViewerContainer.nativeElement.removeEventListener('mousedown', this.mouseDown);
    this.pdfComponent.pdfViewerContainer.nativeElement.removeEventListener('mouseup', this.mouseUp);

    if (this.filterChangeSubscription) {
      this.filterChangeSubscription.unsubscribe();
    }

    if(this.searchChangedSub) {
      this.searchChangedSub.unsubscribe();
    }

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
        element.style.display = visible ? 'block' : 'none';
      }
    }
  }

  addAnnotation(annotation: Annotation, pageNum: number, isCustomAnnotation: boolean) {
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
        rect
      };
      overlayDiv.setAttribute('class', 'system-annotation');
      overlayDiv.setAttribute('location', JSON.stringify(location));
      overlayDiv.setAttribute('meta', JSON.stringify(annotation.meta));
      top = this.normalizeTopCoordinate(top, annotation);
      const opacity = this.normalizeOpacityLevel(annotation);
      const bgcolor = this.normalizeBackgroundColor(annotation);
      overlayDiv.setAttribute('style', `opacity:${opacity}; background-color: ${bgcolor};position:absolute;` +
        'left:' + left + 'px;top:' + (top) + 'px;width:' + width + 'px;height:' + height + 'px;');
      overlayContainer.appendChild(overlayDiv);
      (annotation as any).ref = overlayDiv;
      elementRefs.push(overlayDiv);
      jQuery(overlayDiv).css('cursor', 'move');
      jQuery(overlayDiv).draggable({
        revert: true,
        revertDuration: 0,
        stack: '.draggable',
        appendTo: this.dropAreaIdentifier,
        zIndex: 99999,
        helper: 'clone',
        start(e, ui) {
          jQuery(ui.helper).css('opacity', 1);
          jQuery(ui.helper).css('width', '');
          jQuery(ui.helper).css('height', '');
          jQuery(ui.helper).text(annotation.meta.allText);
        }
      });
      jQuery(overlayDiv).draggable('enable');
      (jQuery(overlayDiv) as any).qtip(
        {
          content: this.prepareTooltipContent(annotation),
          position: {
            my: 'top center',
            at: 'bottom center',
            target: this
          },
          style: {
            classes: 'qtip-bootstrap',
            tip: {
              width: 16,
              height: 8
            }
          },
          show: {
            delay: 10
          },
          hide: {
            fixed: true,
            delay: 150
          }
        }
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
    if (t.indexOf('chemic') > -1 || t.indexOf('disea') > -1) {
      return this.opacity + 0.1;
    }
    return this.opacity;
  }

  normalizeBackgroundColor(an: Annotation): string {
    const t = an.meta.type.toLowerCase();
    if (t.indexOf('chemic') > -1) {
      return '#9cda94';
    }
    if (t.indexOf('disea') > -1) {
      return '#f2ce97';
    }
    return an.meta.color;
  }

  prepareTooltipContent(an: Annotation): string {
    const base = [`Type: ${an.meta.type}`];
    if (an.meta.id) {
      if (an.meta.idHyperlink) {
        base.push(`Id: <a href=${encodeURI(an.meta.idHyperlink)} target="_blank">${an.meta.id}</a>`);
      } else {
        base.push(`Id: ${an.meta.id}`);
      }
    }
    if (an.meta.idType) {
      base.push(`Id Type: ${an.meta.idType}`);
    }
    if (an.meta.isCustom) {
      base.push(`user generated annotation`);
    }
    if (an.meta.links && an.meta.links.google) {
      base.push(`<a target="_blank" href="${an.meta.links.google}">Google</a>`);
    }
    if (an.meta.links && an.meta.links.ncbi) {
      base.push(`<a target="_blank" href="${an.meta.links.ncbi}">NCBI</a>`);
    }
    if (an.meta.links && an.meta.links.uniprot) {
      base.push(`<a target="_blank" href="${an.meta.links.uniprot}">Uniprot</a>`);
    }
    if (an.meta.links && an.meta.links.wikipedia) {
      base.push(`<a target="_blank" href="${an.meta.links.wikipedia}">Wikipedia</a>`);
    }
    return base.join('<br/>');
  }


  processAnnotations(pageNum: number, pdfPageView: any) {
    this.pageRef[pageNum] = pdfPageView;
    const filteredAnnotations = this.annotations.filter((an) => an.pageNumber === pageNum);
    for (const an of filteredAnnotations) {
      this.addAnnotation(an, pageNum, an.meta.isCustom);
    }
  }

  mouseDown = event => {
    this.mouseDownClientX = event.clientX;
    this.mouseDownClientY = event.clientY;
  };

  mouseUp = event => {
    if (this.selectedText && this.selectedText.length
      && Math.abs(this.mouseDownClientX - event.clientX) < this.dragThreshold
      && Math.abs(this.mouseDownClientY - event.clientY) < this.dragThreshold) {
      this.deleteFrictionless();
      return;
    }
    const i = 0;
    const selection = window.getSelection() as any;
    const baseNode = selection.baseNode;
    const parent = baseNode && baseNode.parentNode as any;
    if (!parent || !parent.closest('.textLayer')) {
      // coming not from pdf-viewer
      return false;
    }
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
        return false;
      }
    }
    this.deleteFrictionless();
    this.allText = selection.toString();
    const documentFragment = selection.getRangeAt(0).cloneContents();
    this.selectedText = Array.from(documentFragment.childNodes).map((node: any) => node.textContent);
    this.currentPage = parseInt(parent.closest('.page').getAttribute('data-page-number'), 10);
    const pdfPageView = this.pageRef[this.currentPage];
    const viewport = pdfPageView.viewport;
    const pageElement = pdfPageView.div;
    const pageRect = pdfPageView.canvas.getClientRects()[0];

    this.selectedTextCoords = [];
    const that = this;
    const selected = jQuery.map(selectedRects, r => {

      const rect = viewport.convertToPdfPoint(r.left - pageRect.left, r.top - pageRect.top)
        .concat(viewport.convertToPdfPoint(r.right - pageRect.left, r.bottom - pageRect.top));
      that.selectedTextCoords.push(rect);
      const bounds = viewport.convertToViewportRectangle(rect);
      // if (i % 2 == 0) { // verify if not odd (must be pair)
      const el = document.createElement('div');
      const meta: Meta = {
        allText: that.allText,
        type: 'user-annotation',
        color: 'not-defined'
      };
      const location: Location = {
        pageNumber: that.currentPage,
        rect
      };
      el.setAttribute('location', JSON.stringify(location));
      el.setAttribute('meta', JSON.stringify(meta));
      el.setAttribute('class', 'frictionless-annotation');
      el.setAttribute('style', 'position: absolute; background-color: rgba(255, 255, 51, 0.3);' +
        'left:' + Math.min(bounds[0], bounds[2]) + 'px; top:' + (Math.min(bounds[1], bounds[3]) + 2) + 'px;' +
        'width:' + Math.abs(bounds[0] - bounds[2]) + 'px; height:' + Math.abs(bounds[1] - bounds[3]) + 'px;');
      el.setAttribute('id', 'newElement' + i);
      pageElement.appendChild(el);

      jQuery(el).css('cursor', 'move');
      jQuery(el).draggable({
        revert: true,
        revertDuration: 0,
        stack: '.draggable',
        appendTo: that.dropAreaIdentifier,
        zIndex: 99999,
        helper: 'clone',
        start(e, ui) {
          jQuery(ui.helper).css('opacity', 1);
          jQuery(ui.helper).css('width', '');
          jQuery(ui.helper).css('height', '');
          if (that.isSelectionLink) {
            jQuery(ui.helper).html(`<span class="fa fa-file" style="color: ${annotationTypes.find(type => type.label === 'link').color}"></span>`);
          } else {
            jQuery(ui.helper).text(meta.allText);
          }
        }
      });
      jQuery(el).draggable('enable');

      this.selectedElements.push(el);
      (jQuery(el) as any).qtip(
        {

          content: `<img src="assets/images/annotate.png" onclick="openAnnotationPanel()">
                <img src="assets/images/copy.png" onclick="copySelectedText()">
            <img src="assets/images/link.png" onclick="openLinkPanel()">`,
          position: {
            my: 'bottom center',
            target: 'mouse',
            adjust: {
              mouse: false
            }
          },
          style: {
            classes: 'qtip-bootstrap',
            tip: {
              width: 16,
              height: 8
            }
          },
          show: {
            delay: 10
          },
          hide: {
            fixed: true,
            delay: 200
          }
        }
      );
      // }
      // i++;
    });

    this.clearSelection();
  }

  deleteFrictionless() {
    jQuery('.frictionless-annotation').qtip('destroy');
    jQuery('.frictionless-annotation').remove();
    this.selectedText = [];
    this.selectedTextCoords = [];
    this.allText = '';
    this.isSelectionLink = false;
    this.selectedElements = [];
  }

  openAnnotationPanel() {
    jQuery('.frictionless-annotation').qtip('hide');
    const dialogRef = this.dialog.open(AnnotationPanelComponent, {
      autoFocus: false,
      data: {
        allText: this.allText,
        text: this.selectedText,
        coords: this.selectedTextCoords,
        pageNumber: this.currentPage
      }
    });

    dialogRef.afterClosed().subscribe(annotation => {
      if (annotation) {
        this.annotationCreated.emit(annotation);
        this.deleteFrictionless();
      }
    });
  }

  openAddLinkPanel() {
    this.isSelectionLink = true;
    this.selectedElements.forEach(el => jQuery(el).css('border-bottom', '1px solid'));
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
      pageNumber: pageNum
    });
    if (highlightRect && highlightRect.length > 0) {
      setTimeout(() => {
        this.addHighlightItem(pageNum, highlightRect);
      }, 500);
    }
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
    overlayDiv.setAttribute('style', `opacity:0.3; background-color: black;position:absolute;` +
      'left:' + left + 'px;top:' + (top - 2) + 'px;width:' + width + 'px;height:' + height + 'px;');
    overlayContainer.appendChild(overlayDiv);
    overlayDiv.scrollIntoView();
    jQuery(overlayDiv).effect('highlight', {}, 1000);
    setTimeout(() => {
      jQuery(overlayDiv).remove();
    }, 1500);
  }

  /**
   * Page rendered callback, which is called when a page is rendered (called multiple times)
   */
  pageRendered(e: CustomEvent) {
    this.allPages = this.pdf.numPages;
    this.currentRenderedPage = (e as any).pageNumber;
    const nump = Number(this.pdf.numPages);
    const currentNump = Number((e as any).pageNumber);
    if (nump === currentNump) {
      this.isLoadCompleted = true;
      setTimeout(() => {
        this.loadCompleted.emit(true);
        const tagName = (this.pdfComponent as any).element.nativeElement.tagName.toLowerCase();
        jQuery(tagName).css('height','100vh');
        jQuery(tagName).css('display','block');
      }, 1000);
    }
    const pageNum = (e as any).pageNumber;
    const pdfPageView = (e as any).source;
    this.processAnnotations(pageNum, pdfPageView);
  }

  searchQueryChanged(newQuery: string) {
    if (newQuery !== this.pdfQuery) {
      this.pdfQuery = newQuery;
      this.pdfComponent.pdfFindController.executeCommand('find', {
        query: this.pdfQuery,
        highlightAll: true,
        entireWord: true,
        phraseSearch: true
      });
    } else {
      this.pdfComponent.pdfFindController.executeCommand('findagain', {
        query: this.pdfQuery,
        highlightAll: true,
        entireWord: true,
        phraseSearch: true
      });
    }
  }

  annotationListItemClick($event, ref, pageNumber: number) {
    if (ref) {
      ref.scrollIntoView();
      return;
    }
    this.scrollToPage(Number(pageNumber));
  }

  copySelectedText() {
    let listener = (e: ClipboardEvent) => {
      let clipboard = e.clipboardData || window["clipboardData"];
      clipboard.setData("text", this.allText);
      e.preventDefault();
    };

    document.addEventListener("copy", listener, false)
    document.execCommand("copy");
    document.removeEventListener("copy", listener, false);

    this.deleteFrictionless();

  }

}
