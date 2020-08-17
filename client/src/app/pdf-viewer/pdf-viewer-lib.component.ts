import {
  AfterViewInit,
  Component,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Annotation, RemovedAnnotationExclsuion, Location, Meta, Rect } from './annotation-type';
import { PDFDocumentProxy, PDFProgressData, PDFSource } from './pdf-viewer/pdf-viewer.module';
import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';
import { PDFPageViewport } from 'pdfjs-dist';
import { AnnotationEditDialogComponent } from './components/annotation-edit-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AnnotationExcludeDialogComponent } from './components/annotation-exclude-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AddedAnnotationExclsuion } from 'app/drawing-tool/services/interfaces';

declare var jQuery: any;

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'lib-pdf-viewer-lib',
  templateUrl: './pdf-viewer-lib.component.html',
  styleUrls: ['./pdf-viewer-lib.component.scss'],
})
export class PdfViewerLibComponent implements OnInit, OnDestroy, AfterViewInit {

  @Input() searchChanged: Subject<{ keyword: string, findPrevious: boolean }>;
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
  set addedAnnotationExclusion(exclusionData: AddedAnnotationExclsuion) {
    if (exclusionData) {
      this.changeAnnotationExclusionMark(true, exclusionData);
    }
  }

  @Input()
  set removedAnnotationExclusion(exclusionData: RemovedAnnotationExclsuion) {
    if (exclusionData) {
      this.changeAnnotationExclusionMark(false, exclusionData);
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
  @Output() dropEvents = new EventEmitter();
  @Output() annotationDragStart = new EventEmitter<any>();
  // tslint:disable
  @Output('custom-annotation-created') annotationCreated = new EventEmitter();
  @Output('custom-annotation-removed') annotationRemoved = new EventEmitter();
  @Output('annotation-exclusion-added') annotationExclusionAdded = new EventEmitter();
  @Output('annotation-exclusion-removed') annotationExclusionRemoved = new EventEmitter();

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

  pageRef = {};
  index: any;

  allText: string;
  selectedText: string[];
  selectedTextCoords: Rect[];
  currentPage: number;
  isSelectionLink = false;
  selectedElements: HTMLElement[] = [];

  opacity = 0.3;

  dragAndDropOriginCoord;
  dragAndDropOriginHoverCount;
  dragAndDropDestinationCoord;
  dragAndDropDestinationHoverCount;

  @ViewChild(PdfViewerComponent, {static: false})
  private pdfComponent: PdfViewerComponent;

  constructor(
    private readonly modalService: NgbModal,
    private zone: NgZone,
    private snackBar: MatSnackBar,
  ) {

    (window as any).openAnnotationPanel = () => {
      (window as any).pdfViewerRef.zone.run(() => {
        (window as any).pdfViewerRef.componentFn();
      });
    };
    (window as any).copySelectedText = () => {
      (window as any).pdfViewerRef.zone.run(() => {
        (window as any).pdfViewerRef.copySelectedText();
      });
    }
    (window as any).removeCustomAnnotation = (uuid) => {
      (window as any).pdfViewerRef.zone.run(() => {
        (window as any).pdfViewerRef.removeCustomAnnotation(uuid);
      });
    }
    (window as any).openExclusionPanel = (annExclusion) => {
      (window as any).pdfViewerRef.zone.run(() => {
        (window as any).pdfViewerRef.openExclusionPanel(annExclusion);
      });
    }
    (window as any).removeAnnotationExclusion = (id, text) => {
      (window as any).pdfViewerRef.zone.run(() => {
        (window as any).pdfViewerRef.removeAnnotationExclusion(id, text);
      });
    }
    (window as any).pdfViewerRef = {
      zone: this.zone,
      componentFn: () => this.openAnnotationPanel(),
      copySelectedText: () => this.copySelectedText(),
      removeCustomAnnotation: (uuid) => this.removeCustomAnnotation(uuid),
      openExclusionPanel: (annExclusion) => this.openExclusionPanel(annExclusion),
      removeAnnotationExclusion: (id, text) => this.removeAnnotationExclusion(id, text),
      component: this,
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
      debounceTime(250)).subscribe((sb) => {
      this.searchQueryChanged(sb);
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
          meta.type = 'Link';
          ui.draggable[0].setAttribute('meta', JSON.stringify(meta));

          // Find min value for bottom left point and max value for top right point
          // to save the coordinates of the rect that represents multiple lines
          const location: Location = JSON.parse(ui.draggable[0].getAttribute('location'));
          location.rect = that.selectedTextCoords.reduce((result, rect) => {
            result[0] = Math.min(result[0], rect[0]);
            result[1] = Math.max(result[1], rect[1]);
            result[2] = Math.max(result[2], rect[2]);
            result[3] = Math.min(result[3], rect[3]);
            return result;
          }, [Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MAX_VALUE]);
          ui.draggable[0].setAttribute('location', JSON.stringify(location));
        }

        that.dropEvents.emit({
          event,
          ui,
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
        that.resetSelection();
      },
    });

  }

  ngOnDestroy(): void {

    if (this.filterChangeSubscription) {
      this.filterChangeSubscription.unsubscribe();
    }

    if (this.searchChangedSub) {
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
      (jQuery(overlayDiv) as any).qtip(
        {
          content: this.prepareTooltipContent(annotation),
          position: {
            my: 'top center',
            at: 'bottom center',
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
      base.push(`User generated annotation`);
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
    if (an.meta.isCustom) {
      base.push(`
        <div class="mt-1">
          <button type="button" class="btn btn-primary btn-block" onclick="removeCustomAnnotation('${an.uuid}')">
            <i class="fas fa-fw fa-trash"></i>
            <span>Delete Annotation</span>
          </button>
        </div>
      `);
    }
    if (!an.meta.isCustom && !an.meta.isExcluded) {
      const annExclusion = JSON.stringify({
        id: an.meta.id,
        idHyperlink: an.meta.idHyperlink,
        text: an.textInDocument,
        type: an.meta.type,
        rects: an.rects,
        pageNumber: an.pageNumber
      }).replace(/"/g, '&quot;');
      base.push(`
        <div class="mt-1">
          <button type="button" class="btn btn-primary btn-block" onclick="openExclusionPanel('${annExclusion}')">
            <i class="fas fa-fw fa-minus-circle"></i>
            <span>Mark for Exclusion</span>
          </button>
        </div>
      `)
    }
    if (an.meta.isExcluded) {
      base.push(`
        <div class="mt-2">
          <div>
            <span style="line-height: 16px">Manually excluded</span>
            <span style="line-height: 16px"><i>reason: </i>${an.meta.exclusionReason}</span>
            ${an.meta.exclusionComment ? `<span style="line-height: 16px"><i>comment: </i>${an.meta.exclusionComment}</span>` : ''}
          </div>
          <div class="mt-1">
            <button type="button" class="btn btn-primary btn-block" onclick="removeAnnotationExclusion('${an.meta.type}', '${an.textInDocument}')">
              <i class="fas fa-fw fa-undo"></i>
              <span>Unmark Exclusion</span>
            </button>
          </div>
        </div>`);
    }
    return base.join('<br/>');
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

  @HostListener('window:mouseup', ['$event'])
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
    const originConverted = viewport.convertToPdfPoint(this.dragAndDropOriginCoord.clientX - pageRect.left, this.dragAndDropOriginCoord.clientY - pageRect.top);
    const destinationConverted = viewport.convertToPdfPoint(this.dragAndDropDestinationCoord.clientX - pageRect.left, this.dragAndDropDestinationCoord.clientY - pageRect.top);
    const mouseMoveRectangular = viewport.convertToViewportRectangle([].concat(originConverted).concat(destinationConverted));
    const mouseRectTop = Math.min(mouseMoveRectangular[1], mouseMoveRectangular[3]);
    const mouseRectHeight = Math.abs(mouseMoveRectangular[1] - mouseMoveRectangular[3]);

    const fixedSelectedRects = [];
    const newLineThreshold = .30;
    function createCorrectRects(rects: DOMRectList) {
      let startLowerX = null, startLowerY = null;

      let currentRect = new DOMRect(0, 0, 0, 0);

      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const prevRect = i > 0 ? rects[i-1] : rect
        // point of origin in browser is top left
        const lowerX = rect.left;
        const lowerY = rect.bottom;

        currentRect.height = rect.height;

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
              const rectsOnNewLine = []
              for (let j = i; j < rects.length; j++) {
                rectsOnNewLine.push(rects[j]);
              }

              const unprocessedDOMRects = {length: rectsOnNewLine.length} as DOMRectList;
              rectsOnNewLine.forEach((r, i) => unprocessedDOMRects[i] = r);
              createCorrectRects(unprocessedDOMRects);
              // break because the recursion already calculated the
              // correct currentRect.width before returning
              break;
            }
          }
        }

        currentRect.x = startLowerX;
        currentRect.y = startLowerY - rect.height;

        if (currentRect.width === 0) {
          currentRect.width = rect.width;
        } else if (rect.width > prevRect.width || rect.width < prevRect.width) {
          currentRect.width += rect.width;
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
    createCorrectRects(selectedRects);

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
        type: 'entity',
        color: 'not-defined',
      };
      const location: Location = {
        pageNumber: that.currentPage,
        rect,
      }
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', event => {
        this.annotationDragStart.emit(event);
      });
      el.setAttribute('location', JSON.stringify(location));
      el.setAttribute('meta', JSON.stringify(meta));
      el.setAttribute('class', 'frictionless-annotation');
      el.setAttribute('style', 'position: absolute; background-color: rgba(255, 255, 51, 0.3);' +
        'left:' + left + 'px; top:' + (top + 2) + 'px;' +
        'width:' + width + 'px; height:' + height + 'px;');
      el.setAttribute('id', 'newElement' + idx);

      if (mouseRecTopBorder <= top && mouseRectBottomBorder >= top) {
        pageElement.appendChild(el);
        this.selectedElements.push(el);
      }

      jQuery(el).css('cursor', 'move');

      (jQuery(el) as any).qtip(
        {

          content: `<img src="assets/images/annotate.png" onclick="openAnnotationPanel()">
                <img src="assets/images/copy.png" onclick="copySelectedText()">`,
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
  }

  deleteFrictionless() {
    jQuery('.frictionless-annotation').qtip('destroy');
    jQuery('.frictionless-annotation').remove();
  }

  resetSelection() {
    this.selectedText = [];
    this.selectedTextCoords = [];
    this.allText = '';
    this.isSelectionLink = false;
    this.selectedElements = [];
  }

  openAnnotationPanel() {
    jQuery('.frictionless-annotation').qtip('hide');

    const dialogRef = this.modalService.open(AnnotationEditDialogComponent);
    dialogRef.componentInstance.allText = this.allText;
    dialogRef.componentInstance.text = this.selectedText;
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
    dialogRef.result.then(exclusionData => {
      this.annotationExclusionAdded.emit({ ...exclusionData, ...JSON.parse(annExclusion) });
    }, () => {
    });
  }

  removeAnnotationExclusion(type, text) {
    jQuery('.system-annotation').qtip('hide');
    this.annotationExclusionRemoved.emit({type, text});
  }

  clearSelection() {
    this.isSelectionLink = false;
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
      pageNumber: pageNum,
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
    overlayDiv.setAttribute('style', `border: 2px solid red; position:absolute;` +
      'left:' + (left - 2) + 'px;top:' + (top + 2) + 'px;width:' + (width + 2) + 'px;height:' + (height + 2) + 'px;');
    overlayContainer.appendChild(overlayDiv);
    overlayDiv.scrollIntoView();
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
    const nump = Number(this.pdf.numPages);
    const currentNump = Number((e as any).pageNumber);
    if (nump === currentNump) {
      this.isLoadCompleted = true;
      setTimeout(() => {
        this.loadCompleted.emit(true);
        const tagName = (this.pdfComponent as any).element.nativeElement.tagName.toLowerCase();
      }, 1000);
    }
    const pageNum = (e as any).pageNumber;
    const pdfPageView = (e as any).source;
    this.processAnnotations(pageNum, pdfPageView);
  }

  searchQueryChanged(newQuery: { keyword: string, findPrevious: boolean }) {
    if (newQuery.keyword !== this.pdfQuery) {
      this.pdfQuery = newQuery.keyword;
      this.pdfComponent.pdfFindController.executeCommand('find', {
        query: this.pdfQuery,
        highlightAll: true,
        entireWord: true,
        phraseSearch: true,
        findPrevious: newQuery.findPrevious,
      });
    } else {
      this.pdfComponent.pdfFindController.executeCommand('findagain', {
        query: this.pdfQuery,
        highlightAll: true,
        entireWord: true,
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

    document.addEventListener('copy', listener, false)
    document.execCommand('copy');
    document.removeEventListener('copy', listener, false);

    this.deleteFrictionless();

    this.snackBar.open('It has been copied to clipboard', 'Close', {duration: 5000});

  }

  removeCustomAnnotation(uuid) {
    jQuery('.system-annotation').qtip('hide');
    this.annotationRemoved.emit(uuid);
  }

  changeAnnotationExclusionMark(isExcluded, exclusionData: AddedAnnotationExclsuion | RemovedAnnotationExclsuion) {
    this.annotations.forEach((ann: Annotation) => {
      if (ann.meta.type === exclusionData.type && ann.textInDocument === exclusionData.text) {
        const ref = this.annotationHighlightElementMap.get(ann);
        jQuery(ref).remove();
        ann.meta.isExcluded = isExcluded;
        if ('reason' in exclusionData && 'comment' in exclusionData) {
          ann.meta.exclusionReason = exclusionData.reason;
          ann.meta.exclusionComment = exclusionData.comment;
        }
        this.addAnnotation(ann, ann.pageNumber);
      }
    });
    this.renderFilterSettings();
  }

}
