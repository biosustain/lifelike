import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subscription, Subject } from 'rxjs';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { environment } from 'environments/environment';

import {
  PdfAnnotationsService,
  DataFlowService
} from '../services';

import {
  GraphData
} from '../services/interfaces';

import {
  Annotation
} from '../services/types';

const MOCK_FILES: PdfFile[] = [ // TODO: remove once backend is in place
  {id: '0', filename: 'pdf file number 0', creationDate: '', username: ''},
  {id: '1', filename: 'pdf file number 1', creationDate: '', username: ''},
  {id: '2', filename: 'pdf file number 2', creationDate: '', username: ''},
  {id: '3', filename: 'pdf file number 3', creationDate: '', username: ''},
  {id: '4', filename: 'pdf file number 4', creationDate: '', username: ''},
  {id: '5', filename: 'pdf file number 5', creationDate: '', username: ''},
  {id: '6', filename: 'pdf file number 6', creationDate: '', username: ''},
  {id: '7', filename: 'pdf file number 7', creationDate: '', username: ''},
  {id: '8', filename: 'pdf file number 8', creationDate: '', username: ''},
  {id: '9', filename: 'pdf file number 9', creationDate: '', username: ''},
];


@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})

export class PdfViewerComponent implements AfterViewInit, OnDestroy {

  annotations: object[] = [];
  files: PdfFile[] = MOCK_FILES;
  filesFilter = new FormControl('');
  filesFilterSub: Subscription;
  filteredFiles = this.files;
  pdfFileUrl = '/assets/pdfs/example3-test.pdf'; // TODO: remove asset once backend is in place
  goToPosition =  new Subject<any>();
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
  }

  ngAfterViewInit() {
    setTimeout(
      () => {
        this.pdfAnnService.getMockupAnnotation()
        .subscribe(ann => {
          this.annotations = ann;
        });
      },
      200
    );
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

    const annId = nodeDom.getAttribute('annotation-id');
    const annDef: Annotation = this.pdfAnnService.searchForAnnotation(annId);

    const payload: GraphData = {
      x: mouseEvent.clientX - containerCoord.x,
      y: mouseEvent.clientY,
      label: nodeDom.innerText,
      group: 'group1',//(annDef as string).toLocaleLowerCase(),
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
    //this.pdfFileUrl = `${environment.apiUrl}/api/files/${id}`;
    //console.log(`url passed to pdf viewer: ${this.pdfFileUrl}`);
    console.log('eren commented out this');
  }

  ngOnDestroy() {
    this.filesFilterSub.unsubscribe();
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
}
