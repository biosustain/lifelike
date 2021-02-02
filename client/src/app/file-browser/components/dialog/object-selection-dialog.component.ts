import {Component, Input, OnDestroy} from '@angular/core';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {MessageDialog} from '../../../shared/services/message-dialog.service';
import {FilesystemObject, ProjectImpl} from '../../models/filesystem-object';
import {ObjectSelectService} from '../../services/object-select.service';
import {MessageType} from '../../../interfaces/message-dialog.interface';
import {CommonDialogComponent} from '../../../shared/components/dialog/common-dialog.component';

@Component({
  selector: 'app-object-selection-dialog',
  templateUrl: './object-selection-dialog.component.html',
  providers: [ObjectSelectService],
})
export class ObjectSelectionDialogComponent
  extends CommonDialogComponent<readonly FilesystemObject[]>
  implements OnDestroy {
  @Input() title = 'Select File';
  @Input() emptyDirectoryMessage = 'There are no items in this folder.';

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              readonly objectSelect: ObjectSelectService) {
    super(modal, messageDialog);
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
    this.hashId = project.root.hashId;
  }

  getValue(): readonly FilesystemObject[] {
    if (this.objectSelect.object.children.selection.length) {
      return this.objectSelect.object.children.selection;
    } else {
      return [this.objectSelect.object];
    }
  }

  submit(): void {
    if (this.objectSelect.object != null) {
      super.submit();
    } else {
      this.messageDialog.display({
        title: 'No Selection',
        message: 'You need to select a project first.',
        type: MessageType.Error,
      });
    }
  }

}
