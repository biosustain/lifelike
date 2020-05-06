import { Component, ViewChild, HostListener, OnInit, AfterViewInit, Output, EventEmitter, NgZone, Input } from '@angular/core';
import { Subject } from 'rxjs';

import { annotations } from './annotations';
import { PDFPageViewport } from 'pdfjs-dist';
import { MatDialog } from '@angular/material/dialog';
declare var jQuery: any;


@Component({
  moduleId: module.id,
  selector: 'pdf-viewer-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  annotations = [];
  pdfSrc = './assets/proteins_covid.pdf';
  goToPosition = new Subject<any>();
  handleDropArea = true;
  dropAreaIdentifier = '#drop-area';
  debugMode = true;
  addedAnnotation;

  constructor() {

  }
  ngOnInit() {

  }
  dropEvents($event) {
    console.log('drop events ', $event);
  }
  annotationCreated($event) {
    console.log('annotation is ', $event);
    this.addedAnnotation = $event;
  }
  loadCompleted($event) {
    console.log('pdf load is completed');
    this.goToPosition.next({
      pageNumber: 14,
      rect: [0, 0, 100, 100]
    })
  }
}
