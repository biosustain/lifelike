import {Injectable} from '@angular/core';
import {ProgressDialogComponent} from '../components/dialog/progress-dialog.component';
import {Observable} from 'rxjs';
import {Progress} from '../../interfaces/common-dialog.interface';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';

export interface ProgressDialogArguments {
  title: string;
  progressObservable: Observable<Progress>;
}

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
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
