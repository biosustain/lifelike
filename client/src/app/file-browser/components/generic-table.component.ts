import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { DirectoryObject } from '../../interfaces/projects.interface';

@Component({
  selector: 'app-generic-table',
  templateUrl: './generic-table.component.html',
  styleUrls: ['./generic-table.component.scss']
})
export class GenericTableComponent{
  HEADER: TableHeader[][];
  numColumns: number[];
  entries: string[][];
  constructor() {
    console.log("reached");
    
  }

  @Input() 
  set header(header: TableHeader[][]){
    this.HEADER = header;
  }
  @Input()
  set columns(num: number){
    this.numColumns = new Array(num);
  }
  @Input()
  set rows(entries: string[][]){
    this.entries = entries;
    console.log(this.entries);
  }
}

export class TableHeader{
  name: string;
  span: string;

  constructor(name: string, span: string){
    this.name = name;
    this.span = span;
  }
}