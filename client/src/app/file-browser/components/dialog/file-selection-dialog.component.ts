import { Component, Input, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { FilesystemObject, PathLocator } from '../../models/filesystem-object';
import { Project } from '../../services/project-space.service';
import { ObjectSelectService } from '../../services/object-select.service';
import { MessageType } from '../../../interfaces/message-dialog.interface';

@Component({
  selector: 'app-directory-selection-dialog',
  templateUrl: './file-selection-dialog.component.html',
  providers: [ObjectSelectService],
})
export class FileSelectionDialogComponent implements OnDestroy {
  @Input() title = 'Select File';

  constructor(readonly modal: NgbActiveModal,
              readonly messageDialog: MessageDialog,
              readonly objectSelect: ObjectSelectService) {
  }

  ngOnDestroy(): void {
  }

  @Input()
  set locator(locator: PathLocator) {
    this.objectSelect.load(locator);
  }

  @Input()
  set objectFilter(filter: (item: FilesystemObject) => boolean) {
    this.objectSelect.objectFilter = filter;
  }

  @Input()
  set multipleSelection(multipleSelection: boolean) {
    this.objectSelect.multipleSelection = multipleSelection;
  }

  openProject(project: Project) {
    this.locator = {
      projectName: project.projectName,
      directoryId: null,
    };
  }

  getSelectionText(): string {
    if (this.objectSelect.object != null) {
      const selection = this.objectSelect.object.children.selection;
      if (selection.length) {
        if (selection.length === 1) {
          return `'${selection[0].name}'`;
        } else {
          return `(${selection.length})`;
        }
      } else {
        return 'This';
      }
    } else {
      return '';
    }
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
