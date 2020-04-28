import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { throttleTime } from 'rxjs/operators';
import { asyncScheduler, Subject, Subscription } from 'rxjs';
import { UploadProgress, UploadStatus } from '../interfaces/file-browser.interfaces';

/**
 * A dialog to indicate the status of a file upload.
 */
@Component({
  selector: 'app-upload-progress-dialog',
  templateUrl: './upload-progress-dialog.component.html',
  styleUrls: ['./upload-progress-dialog.component.scss'],
})
export class UploadProgressDialogComponent implements OnInit, OnDestroy {
  progress: Subject<UploadProgress>;
  progressUpdated: Subscription;
  /**
   * Periodically updated with the progress of the upload.
   */
  lastProgress: UploadProgress = new UploadProgress(UploadStatus.Ready, 0);

  constructor(private dialogRef: MatDialogRef<UploadProgressDialogComponent>,
              @Inject(MAT_DIALOG_DATA) data) {
    this.progress = data.progress;
  }

  ngOnInit() {
    this.progressUpdated = this.progress
      .pipe(throttleTime(250, asyncScheduler, {
        leading: true,
        trailing: true
      })) // The progress bar cannot be updated more than once every 250ms due to its CSS animation
      .subscribe(this.handleProgress.bind(this));
  }

  ngOnDestroy() {
    this.progressUpdated.unsubscribe();
  }

  handleProgress(value: UploadProgress) {
    this.lastProgress = value;
  }

  get filename() {
    return this.lastProgress.name;
  }

  get progressBarValue(): number {
    // We basically only are interested in the progress % if we are in the
    // uploading stage because value has to be 0 for the "buffer animation" to show
    // if we are using the buffer progress bar type for the "processing" stage
    if (this.lastProgress.status === UploadStatus.Uploading) {
      return this.lastProgress.progress * 100;
    } else {
      return 0;
    }
  }

  get progressBarMode(): string {
    switch (this.lastProgress.status) {
      case UploadStatus.Starting:
      case UploadStatus.Uploading:
        return 'determinate';
      case UploadStatus.Processing:
        return 'buffer';
      default:
        return 'indeterminate';
    }
  }

  get status(): string {
    switch (this.lastProgress.status) {
      case UploadStatus.Starting:
        return 'Preparing file for upload...';
      case UploadStatus.Uploading:
        return 'Uploading file...';
      case UploadStatus.Processing:
        return 'Processing on server...';
      default:
        return 'Working...';
    }
  }
}
