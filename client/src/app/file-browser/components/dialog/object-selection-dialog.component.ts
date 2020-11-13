import { Component, Input, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { FilesystemObject, PathLocator, ProjectImpl } from '../../models/filesystem-object';
import { Project } from '../../services/project-space.service';
import { ObjectSelectService } from '../../services/object-select.service';
import { MessageType } from '../../../interfaces/message-dialog.interface';

@Component({
  selector: 'app-object-selection-dialog',
  templateUrl: './object-selection-dialog.component.html',
  providers: [ObjectSelectService],
})
export class ObjectSelectionDialogComponent implements OnDestroy {
  @Input() title = 'Select File';
  @Input() emptyDirectoryMessage = 'There are no items in this folder.';

  constructor(readonly modal: NgbActiveModal,
              readonly messageDialog: MessageDialog,
              readonly objectSelect: ObjectSelectService) {
  }

  ngOnDestroy(): void {
  }

  @Input()
  set hashId(hashId: string) {
    this.objectSelect.load(hashId);
  }

  @Input()
  set objectFilter(filter: (item: FilesystemObject) => boolean) {
    this.objectSelect.objectFilter = filter;
  }

  @Input()
  set multipleSelection(multipleSelection: boolean) {
    this.objectSelect.multipleSelection = multipleSelection;
  }

  openProject(project: ProjectImpl) {
    this.hashId = project.***ARANGO_USERNAME***.hashId;
  }

  cancel() {
    this.modal.dismiss();
  }

  submit(): void {
    if (this.objectSelect.object != null) {
      if (this.objectSelect.object.children.selection.length) {
        this.modal.close(this.objectSelect.object.children.selection);
      } else {
        this.modal.close([this.objectSelect.object]);
      }
    } else {
      this.messageDialog.display({
        title: 'No Selection',
        message: 'You need to select a project first.',
        type: MessageType.Error,
      });
    }
  }

}
