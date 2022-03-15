import { Component, Input, OnDestroy } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { isEmpty } from 'lodash-es';
import { first, map, switchMap } from 'rxjs/operators';
import { iif, of } from 'rxjs';

import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { CommonDialogComponent } from 'app/shared/components/dialog/common-dialog.component';

import { FilesystemObject, ProjectImpl } from '../../models/filesystem-object';
import { ObjectSelectService } from '../../services/object-select.service';

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

  getValue(): Promise<readonly FilesystemObject[]> {
    return this.objectSelect.object$.pipe(
      switchMap((object: FilesystemObject) => object.children.selection$.pipe(
        map(items => isEmpty(items) ? [object] : items)
      )),
      first(),
    ).toPromise();
  }

  submit() {
    return this.objectSelect.object$.pipe(
      switchMap(object =>
        iif(
          () => object != null,
          of(super.submit()),
          this.messageDialog.display({
            title: 'No Selection',
            message: 'You need to select a project first.',
            type: MessageType.Error,
          } as MessageArguments)
        )
      ),
      first()
    ).toPromise();
  }
}
