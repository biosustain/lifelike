import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  asyncScheduler,
  BehaviorSubject,
  Observable,
  Subscription,
  combineLatest,
  defer,
  Subject,
  of,
  forkJoin,
  ReplaySubject,
} from 'rxjs';
import {
  throttleTime,
  map,
  combineAll,
  shareReplay,
  first,
  takeUntil,
  tap,
  mergeMap,
  switchMap,
} from 'rxjs/operators';
import { flatMap, reduce, size } from 'lodash-es';

import { Progress, ProgressArguments, ProgressMode } from 'app/interfaces/common-dialog.interface';

import { isNotEmpty } from '../../../../utils';

/**
 * A dialog to indicate the progress of a process.
 */
@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
})
export class ProgressDialogComponent {
  @Input() title: string;
  @Input() progressObservables: Observable<Progress>[];
  persist: boolean;

  @Input() cancellable = false;
  @Output() readonly progressCancel = new EventEmitter<any>();

  constructor(public activeModal: NgbActiveModal) {}

  cancel() {
    this.activeModal.dismiss();
    this.progressCancel.emit();
  }

  close() {
    return combineLatest(this.progressObservables)
      .pipe(
        map(
          (progresses) =>
            reduce(
              progresses,
              (acc, { info, warnings, errors }) => acc + size(info) + size(warnings) + size(errors),
              0
            ) > 0
        )
      )
      .pipe(
        first(),
        tap((persist) => {
          if (persist) {
            this.persist = true;
          } else {
            this.cancel();
          }
        })
      )
      .toPromise();
  }
}

export function getProgressStatus(event, loadingStatus: string, finishStatus: string): Progress {
  if (event.loaded >= event.total) {
    return new Progress({
      mode: ProgressMode.Buffer,
      status: loadingStatus,
      value: event.loaded / event.total,
    });
  }
  return new Progress({
    mode: ProgressMode.Determinate,
    status: finishStatus,
    value: event.loaded / event.total,
  });
}
