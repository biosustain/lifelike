import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  NgZone,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { isEmpty, once } from 'lodash-es';

import { openModal } from 'app/shared/utils/modals';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';

import { AnnotationEditDialogComponent } from './annotation-edit-dialog.component';
import { Rect } from '../annotation-type';
import { PDFAnnotationService } from '../services/pdf-annotation.service';

@Component({
  selector: 'app-annotation-toolbar',
  styleUrls: ['./annotation-toolbar.component.scss'],
  templateUrl: './annotation-toolbar.component.html',
  encapsulation: ViewEncapsulation.None
})
export class AnnotationToolbarComponent {

  constructor(protected readonly elementRef: ElementRef,
              protected readonly modalService: NgbModal,
              protected readonly zone: NgZone,
              protected readonly snackBar: MatSnackBar,
              protected readonly errorHandler: ErrorHandler,
              protected readonly pdfAnnotation: PDFAnnotationService
  ) {
  }

  @Input() set position(position) {
    this.style = {
      visibility: 'visible',
      top: position.top + 'px',
      left: position.left + 'px'
    };
  }

  @Input() pageRef;

  @HostBinding('class.active') @Input() active: boolean;

  @Input() containerRef;

  @HostBinding('style') style: { [klass: string]: string } | null;

  copySelectionText(event) {
    event.preventDefault();
    navigator.clipboard.writeText(window.getSelection().toString()).then(() => {
      this.snackBar.open('Copied text to clipboard.', null, {
        duration: 2000,
      });
    }, () => {
      this.snackBar.open('Failed to copy text.', null, {
        duration: 2000,
      });
    });
  }

  getPageNumber(page: Element): number {
    return parseInt(page.getAttribute('data-page-number'), 10);
  }

  wrappingPage(node: Node) {
    const element = node instanceof Element ? node : node.parentElement;
    return element.closest('.page');
  }

  private detectFirstPageFromRange(range: Range): [Element, boolean] {
    let multipage = false;
    for (const containerAccessor of ['commonAncestorContainer', 'startContainer', 'endContainer']) {
      const wrappingPage = this.wrappingPage(range[containerAccessor]);
      if (wrappingPage) {
        return [wrappingPage, multipage];
      }
      multipage = true;
    }
  }

  openAnnotationDialog(text, pageNumber, ranges) {
      const dialogRef = openModal(this.modalService, AnnotationEditDialogComponent);
      dialogRef.componentInstance.allText = text;
      dialogRef.componentInstance.keywords = [text];
      dialogRef.componentInstance.coords = this.toPDFRelativeRects(pageNumber, ranges.map(range => range.getBoundingClientRect()));
      dialogRef.componentInstance.pageNumber = pageNumber;
      return dialogRef.result.then(
        annotation => this.pdfAnnotation.annotationCreated(annotation)
      );
  }

  async openAnnotationPanel(event) {
    event.preventDefault();
    const selection = window.getSelection();
    const limitSelectionToOnePage = once(async () => {
      const dialogRef = this.modalService.open(ConfirmDialogComponent);
      dialogRef.componentInstance.message =
        'Annotations across pages are not supported, would you like to limit it to the first page?';
      return dialogRef.result;
    });
    let annotationPage;
    const ranges = [];
    for (const range of this.getValidSelectionRanges(selection)) {
      const [page, multipage] = this.detectFirstPageFromRange(range);
      if (!annotationPage) {
        annotationPage = page;
      }
      if ((page !== annotationPage) || multipage) {
        if (await limitSelectionToOnePage()) {
          selection.removeRange(range);
          if (page !== annotationPage) {
            // range ends on annotation page
            if (this.wrappingPage(range.endContainer) === annotationPage) {
              // select fron begin of the page
              range.setStartBefore(annotationPage);
            } else {
              // if we cannot find right subset of range then keep it deleted
              continue;
            }
          } else if (multipage) {
            // select till the end of the page
            range.setEndAfter(annotationPage);
          }
          selection.addRange(range);
        } else {
          return this.snackBar.open(
            'Annotation creation has been cancelled.',
            'Close',
            {duration: 3000}
          );
        }
      }
      ranges.push(range);
    }
    if (isEmpty(ranges)) {
     return this.errorHandler.showError(
       new Error('openAnnotationPanel(): failed to get selection or page on PDF viewer')
     );
    }
    const text = selection.toString().trim();
    const pageNumber = this.getPageNumber(annotationPage);
    return this.openAnnotationDialog(text, pageNumber, ranges).then(
      () => window.getSelection().empty(),
      () => ranges.forEach(r => window.getSelection().addRange(r))
    );
  }

  private toPDFRelativeRects(pageNumber: number, rects: (ClientRect | DOMRect)[]): Rect[] {
    const pdfPageView = this.pageRef[pageNumber];
    const viewport = pdfPageView.viewport;
    const pageRect = pdfPageView.canvas.getClientRects()[0];
    const ret: Rect[] = [];
    for (const r of rects) {
      ret.push(viewport.convertToPdfPoint(r.left - pageRect.left, r.top - pageRect.top)
        .concat(viewport.convertToPdfPoint(r.right - pageRect.left, r.bottom - pageRect.top)));
    }
    return ret;
  }

  isSelectionAnnotatable(): boolean {
    const text = window.getSelection().toString();
    return text.trim() !== '';
  }

  /**
   * Get a list of valid selections within the text.
   *
   * @param selection the selection to parse
   */
  private *getValidSelectionRanges(selection: Selection): Generator<Range> {
    const container = this.containerRef.nativeElement;
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (!range.collapsed && (container.contains(range.startContainer) || container.contains(range.endContainer))) {
        yield range;
      }
    }
  }
}
