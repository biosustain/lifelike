import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { throttleTime } from 'rxjs/operators';
import { asyncScheduler, Observable, Subscription } from 'rxjs';
import { Progress } from 'app/interfaces/common-dialog.interface';

/**
 * A dialog to indicate the progress of a process.
 */
@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
  styleUrls: ['./progress-dialog.component.scss'],
})
export class ProgressDialogComponent implements OnInit, OnDestroy {
  title: string;
  progressObservable: Observable<Progress>;
  progressSubscription: Subscription;
  /**
   * Periodically updated with the progress of the upload.
   */
  lastProgress: Progress = new Progress();

  constructor(private dialogRef: MatDialogRef<ProgressDialogComponent>,
              @Inject(MAT_DIALOG_DATA) data) {
    this.title = data.title;
    this.progressObservable = data.progressObservable;
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
