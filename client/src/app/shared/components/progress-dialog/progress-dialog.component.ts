import {Component, Inject, Input, OnDestroy, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {throttleTime} from 'rxjs/operators';
import {asyncScheduler, Observable, Subscription} from 'rxjs';
import {Progress} from 'app/interfaces/common-dialog.interface';
import {NgbActiveModal} from "@ng-bootstrap/ng-bootstrap";

/**
 * A dialog to indicate the progress of a process.
 */
@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
})
export class ProgressDialogComponent implements OnInit, OnDestroy {
  @Input() title: string;
  @Input() progressObservable: Observable<Progress>;
  progressSubscription: Subscription;
  /**
   * Periodically updated with the progress of the upload.
   */
  lastProgress: Progress = new Progress();

  constructor(public activeModal: NgbActiveModal) {
  }

  ngOnInit() {
    this.progressSubscription = this.progressObservable
      .pipe(throttleTime(250, asyncScheduler, {
        leading: true,
        trailing: true
      })) // The progress bar cannot be updated more than once every 250ms due to its CSS animation
      .subscribe(value => this.lastProgress = value);
  }

  ngOnDestroy() {
    this.progressSubscription.unsubscribe();
  }
}
