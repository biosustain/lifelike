import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { Directory } from '../../../services/project-space.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-enrichment-table-order-dialog',
  templateUrl: './enrichment-table-order-dialog.component.html',
  styleUrls: ['./enrichment-table-order-dialog.component.scss'],
})
export class EnrichmentTableOrderDialogComponent extends CommonFormDialogComponent implements OnInit {
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


