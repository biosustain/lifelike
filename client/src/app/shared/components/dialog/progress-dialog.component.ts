import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { asyncScheduler, Observable, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import { Progress } from 'app/interfaces/common-dialog.interface';


/**
 * A dialog to indicate the progress of a process.
 */
@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
})
export class ProgressDialogComponent implements OnInit, OnDestroy {
  @Input() title: string;
  @Input()
  set progressObservable(observables: Observable<Progress>[] | Observable<Progress>) {
    if (observables != null) {
      this.progressObservables = Array.isArray(observables) ? observables : [observables];
    } else {
      this.progressObservables = [];
    }
  }

  @Input() cancellable = false;
  @Output() readonly progressCancel = new EventEmitter<any>();
  progressSubscriptions: Subscription[] = [];
  /**
   * Periodically updated with the progress of the upload.
   */
  lastProgresses: Progress[] = [];

  progressObservables: Observable<Progress>[];


  constructor(public activeModal: NgbActiveModal) {
  }

  ngOnInit() {
    for (let i = 0; i < this.progressObservables.length; i++) {
      const progressObservable = this.progressObservables[i];
      this.lastProgresses.push(new Progress());
      this.progressSubscriptions[i] = progressObservable
        .pipe(throttleTime(250, asyncScheduler, {
          leading: true,
          trailing: true,
        })) // The progress bar cannot be updated more than once every 250ms due to its CSS animation
        .subscribe(value => this.lastProgresses[i] = value);
    }
  }

  ngOnDestroy() {
    for (const progressSubscription of this.progressSubscriptions) {
      progressSubscription.unsubscribe();
    }
  }

  cancel() {
    this.activeModal.dismiss();
    this.progressCancel.emit();
  }
}
