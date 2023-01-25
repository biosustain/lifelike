import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output, SimpleChanges,
} from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { asyncScheduler, BehaviorSubject, Observable, Subscription, combineLatest, defer } from 'rxjs';
import { throttleTime, map, combineAll } from 'rxjs/operators';
import { flatMap } from 'lodash-es';

import {
  Progress,
  ProgressArguments,
  ProgressMode,
  ProgressSubject,
} from 'app/interfaces/common-dialog.interface';

import { isNotEmpty } from '../../utils';


/**
 * A dialog to indicate the progress of a process.
 */
@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
})
export class ProgressDialogComponent {
  @Input() title: string;
  @Input() progressObservables: ProgressSubject[];
  persist: boolean;
  closable$: Observable<boolean> = defer(() =>
    combineLatest([
      ...this.progressObservables.map(po => po.warnings$),
      ...this.progressObservables.map(po => po.errors$)
    ]).pipe(
      map(progressWarnings => flatMap(progressWarnings)),
      map(warnings => isNotEmpty(warnings)),
    ),
  );

  @Input() cancellable = false;
  @Output() readonly progressCancel = new EventEmitter<any>();

  constructor(public activeModal: NgbActiveModal) {}

  cancel() {
    this.activeModal.dismiss();
    this.progressCancel.emit();
  }

  close() {
    this.persist = isNotEmpty(
      flatMap([
        ...this.progressObservables.map(po => po.warnings),
        ...this.progressObservables.map(po => po.errors),
      ]),
    );
    if (!this.persist) {
      this.cancel();
    }
  }
}

export function getProgressStatus(event, loadingStatus: string, finishStatus: string): ProgressArguments {
  if (event.loaded >= event.total) {
    return {
      mode: ProgressMode.Buffer,
      status: loadingStatus,
      value: event.loaded / event.total,
    };
  }
  return {
      mode: ProgressMode.Determinate,
      status: finishStatus,
      value: event.loaded / event.total,
    };
}
