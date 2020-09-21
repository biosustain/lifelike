import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { GenericTableComponent, TableHeader} from './generic-table.component';

@Component({
  selector: 'app-worksheet-viewer',
  templateUrl: './worksheet-viewer.component.html',
  styleUrls: ['./worksheet-viewer.component.scss']
})
export class WorksheetViewerComponent implements OnInit, OnDestroy {
  tableHeader: TableHeader[][] = [
    [new TableHeader("Gene", "1"), new TableHeader("Regulon", "1"), new TableHeader("Uniprot", "2"),
    new TableHeader("String", "2"), new TableHeader("Go Enrichment", "6"), new TableHeader("Ecocyc", "2")],
    [new TableHeader("", "1"), new TableHeader("", "1"), new TableHeader("", "1"), new TableHeader("", "1"),
    new TableHeader("", "1"), new TableHeader("", "1"), new TableHeader("Molecular Function", "2"),
    new TableHeader("Biological Process", "2"), new TableHeader("Cellular Componenet", "2"), new TableHeader("", "1"),new TableHeader("", "1"),]
  ];
  numColumns: number = 14;
  entries: string[][] = [["placeholder", "placeholder", "", "placeholder", "placeholder", "placeholder", "placeholder", "placeholder", "placeholder", "placeholder", "placeholder", "placeholder", "placeholder", "placeholder"]];;
  constructor() {
    console.log("reached");
    
  }
  ngOnInit() {
  }
  ngOnDestroy() {

  }
}