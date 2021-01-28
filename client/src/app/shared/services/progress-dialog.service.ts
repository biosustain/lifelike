import {Injectable} from '@angular/core';

import {NgbModal} from '@ng-bootstrap/ng-bootstrap';

import {Observable} from 'rxjs';

import {ProgressDialogComponent} from '../components/dialog/progress-dialog.component';
import {Progress} from '../../interfaces/common-dialog.interface';

export interface ProgressDialogArguments {
  title: string;
  progressObservable: Observable<Progress>;
}

@Injectable({
  providedIn: 'root',
})
export class ProgressDialog {
  constructor(
    public modalService: NgbModal
  ) {
  }

  display(args: ProgressDialogArguments) {
    const modalRef = this.modalService.open(ProgressDialogComponent);
    modalRef.componentInstance.title = args.title;
    modalRef.componentInstance.progressObservable = args.progressObservable;
    return modalRef;
  }
}
