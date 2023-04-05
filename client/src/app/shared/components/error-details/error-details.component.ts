import { Component, Input, AfterViewInit, ViewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageType } from 'app/interfaces/message-dialog.interface';
import { ErrorLog } from 'app/shared/schemas/common';

import { MessageArguments } from '../../services/message-dialog.service';
import { TreeViewComponent } from '../tree-view/tree-view.component';

/**
 * A generic alert dialog.
 */
@Component({
  selector: 'app-error-details',
  templateUrl: './error-details.component.html',
  styleUrls: ['./error-details.component.scss'],
})
export class ErrorDetailsComponent implements AfterViewInit {
  @Input() error: ErrorLog;
  @ViewChild(TreeViewComponent) causeView: TreeViewComponent;

  ngAfterViewInit() {
    const {causeView} = this;
    if (causeView) {
      causeView.treeControl.dataNodes = this.causeView?.dataSource;
      causeView.treeControl.expandAll();
    }
  }

  causeAccessor = ({cause}) => [cause];
  hasCauseAccessor = (_, {cause}) => Boolean(cause);
}
