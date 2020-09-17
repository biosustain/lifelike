import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { DirectoryObject } from '../../interfaces/projects.interface';

@Component({
  selector: 'app-worksheet-viewer',
  templateUrl: './worksheet-viewer.component.html',
  styleUrls: ['./worksheet-viewer.component.scss']
})
export class WorksheetViewerComponent{

  constructor() {
    console.log("reached");
    
  }
}