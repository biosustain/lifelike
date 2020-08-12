import {Component, Input, OnInit} from '@angular/core';
import {PDFResult} from "../../interfaces";

@Component({
  selector: 'app-file-records',
  templateUrl: './file-records.component.html',
  styleUrls: ['./file-records.component.scss']
})
export class FileRecordsComponent implements OnInit {

  @Input() results: PDFResult;

  constructor() {
  }

  ngOnInit() {
  }

}
