import { Component, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subscription, Subject, combineLatest } from 'rxjs';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';

import {
  PdfAnnotationsService,
} from '../services';

import {
  Annotation, Location, Meta
} from '../services/interfaces';

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})

export class PdfViewerComponent implements OnDestroy {

  annotations: Annotation[] = [];
  files: PdfFile[] = [];
  filesFilter = new FormControl('');
  filesFilterSub: Subscription;
  filteredFiles = this.files;

  goToPosition: Subject<Location> = new Subject<Location>();
  openPdfSub: Subscription;
  pdfViewerReady = false;
  pdfFileLoaded = false;
  // Type information coming from interface PDFSource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pdfjs-dist/index.d.ts
  pdfData: { url?: string, data?: Uint8Array };

  constructor(
    private pdfAnnService: PdfAnnotationsService,
    private pdf: PdfFilesService,
  ) {
    this.filesFilterSub = this.filesFilter.valueChanges.subscribe(this.updateFilteredFiles);
    this.pdf.getFiles().subscribe((files: PdfFile[]) => {
      this.files = files;
      this.updateFilteredFiles(this.filesFilter.value);
    });
    // Handles opening a pdf from other pages
    const fileId = localStorage.getItem('fileIdForPdfViewer');
    if (fileId) {
      localStorage.removeItem('fileIdForPdfViewer');
      this.openPdf(fileId);
    }
  }

  annotationCreated(annotation) {
    console.log('annotation is created', annotation);
  }

  /**
   * Handle drop event from draggable annotations
   * of the pdf-viewer
   * @param event represents a drop event
   */
  drop(event) {
    const mouseEvent = event.event.originalEvent.originalEvent as MouseEvent;
    const nodeDom = event.ui.draggable[0] as HTMLElement;

    const containerCoord: DOMRect =
      document
        .getElementById('drawing-tool-view-container')
        .getBoundingClientRect() as DOMRect;

    // everything that graphbuilder might need is under meta
    const meta: Meta = JSON.parse(nodeDom.getAttribute('meta')) as Meta;

    // use location object to scroll in the pdf.
    const loc: Location = JSON.parse(nodeDom.getAttribute('location')) as Location;

    // custom annotations dont have id yet.
    // const annDef: Annotation = this.pdfAnnService.searchForAnnotation(annId);

    /*
    const payload: GraphData = {
      x: mouseEvent.clientX - containerCoord.x,
      y: mouseEvent.clientY,
      label: nodeDom.innerText,
      group: (meta.type as string).toLowerCase(),
      hyperlink: this.generateHyperlink(annDef)
    };
    */
    // hyperlink should be hyperlinks. Those are in Meta field called Links.

    // this.dataFlow.pushNode2Canvas(payload);
  }

  private updateFilteredFiles = (name: string) => {
    this.filteredFiles = this.files.filter(
      (file: PdfFile) => file.filename.includes(name.toLocaleLowerCase())
    );
  }

  openPdf(id: string) {
    this.pdfFileLoaded = false;
    this.pdfViewerReady = false;
    this.openPdfSub = combineLatest(
      this.pdf.getFile(id),
      this.pdfAnnService.getFileAnnotations(id)
    ).subscribe(([pdf, ann]) => {
      this.pdfData = { data: new Uint8Array(pdf) };
      this.annotations = ann;
      setTimeout(() => {
        this.pdfViewerReady = true;
      }, 10);
    });
  }

  ngOnDestroy() {
    this.filesFilterSub.unsubscribe();
    if (this.openPdfSub) {
      this.openPdfSub.unsubscribe();
    }
  }

  generateHyperlink(annDef: Annotation): string {

    switch (annDef.meta.type) {
      case 'Chemical':
        const id = annDef.meta.id.match(/(\d+)/g)[0];
        return `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${id}`;
      case 'Gene':
        return `https://www.ncbi.nlm.nih.gov/gene/?term=${annDef.meta.id}`;
      default:
        return '';
    }
  }

  scrollInPdf(loc: Location) {
    if (!this.pdfFileLoaded) {
      console.log('File in the pdf viewer is not loaded yet. So, I cant scroll');
      return;
    }
    this.goToPosition.next(loc);
  }

  loadCompleted(status) {
    this.pdfFileLoaded = status;
  }
}