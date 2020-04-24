import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';

import {
  PdfAnnotationsService,
  DataFlowService
} from '../services';

import {
  Annotation,
  GraphData
} from '../services/interfaces';


@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})

export class PdfViewerComponent implements AfterViewInit, OnDestroy {

  annotations: object[] = [];
  files: PdfFile[] = [];
  filesFilter = new FormControl('');
  filesFilterSub: Subscription;
  filteredFiles = this.files;

  // Type information coming from interface PDFSource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pdfjs-dist/index.d.ts
  // TODO: feel free to remove the sample.pdf when desired. In that case, also mocked annotations should be removed
  pdfData: {url?: string, data?: Uint8Array} = {url: '/assets/pdfs/sample.pdf'};

  constructor(
    private pdfAnnService: PdfAnnotationsService,
    private dataFlow: DataFlowService,
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

  ngAfterViewInit() {
    setTimeout(
      () => {
        // TODO: Should this be updated at this point?
        this.pdfAnnService.getMockupAnnotation()
        .subscribe(ann => {
          this.annotations = ann;
        });
      },
      200
    );
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

    const annId = nodeDom.getAttribute('annotation-id');
    const annDef: Annotation = this.pdfAnnService.searchForAnnotation(annId);

    const payload: GraphData = {
      x: mouseEvent.clientX - containerCoord.x,
      y: mouseEvent.clientY,
      label: nodeDom.innerText,
      group: (annDef.type as string).toLocaleLowerCase(),
      hyperlink: this.generateHyperlink(annDef)
    };

    this.dataFlow.pushNode2Canvas(payload);
  }

  private updateFilteredFiles = (name: string) => {
    this.filteredFiles = this.files.filter(
      (file: PdfFile) => file.filename.includes(name.toLocaleLowerCase())
    );
  }

  openPdf(id: string) {
    this.pdf.getFile(id).subscribe((pdfData: ArrayBuffer) => {
      this.annotations = [];
      // TODO: update annotations?
      this.pdfData = {data: new Uint8Array(pdfData)};
    });
  }

  ngOnDestroy() {
    this.filesFilterSub.unsubscribe();
  }

  generateHyperlink(annDef: Annotation): string {

    switch (annDef.type) {
      case 'Chemical':
        const id = annDef.id.match(/(\d+)/g)[0];
        return `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${id}`;
      case 'Gene':
        return `https://www.ncbi.nlm.nih.gov/gene/?term=${annDef.id}`;
      default:
        return '';
    }
  }
}
