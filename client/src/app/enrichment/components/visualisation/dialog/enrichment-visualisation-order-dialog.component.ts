import {Component, Input, OnInit} from '@angular/core';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {FormArray, FormGroup} from '@angular/forms';
import {CommonFormDialogComponent} from 'app/shared/components/dialog/common-form-dialog.component';
import {MessageDialog} from 'app/shared/services/message-dialog.service';
import {CdkDragDrop, moveItemInArray} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-enrichment-visualisation-order-dialog',
  templateUrl: './enrichment-visualisation-order-dialog.component.html',
  styleUrls: ['./enrichment-visualisation-order-dialog.component.scss'],
})
export class EnrichmentVisualisationOrderDialogComponent extends CommonFormDialogComponent implements OnInit {
  @Input() domains: string[];

  form: FormGroup = new FormGroup({
    domainsList: new FormArray([]),
  });

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
  ) {
    super(modal, messageDialog);
  }

  ngOnInit() {

  }

  getValue() {
    return this.domains;
  }

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.domains, event.previousIndex, event.currentIndex);
  }
}


