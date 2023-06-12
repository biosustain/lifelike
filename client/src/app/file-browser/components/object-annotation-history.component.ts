import { Component, Input } from '@angular/core';

import { from, Observable, Subscription } from 'rxjs';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { addStatus, PipeStatus } from 'app/shared/pipes/add-status.pipe';
import {
  fileAnnotationChangeDataLoadingMock,
  fileAnnotationHistoryResponseLoadingMock,
} from 'app/shared/mocks/loading/annotation';

import { FileAnnotationHistory } from '../models/file-annotation-history';
import { FilesystemService } from '../services/filesystem.service';
import { FilesystemObject } from '../models/filesystem-object';

@Component({
  selector: 'app-object-annotation-history',
  templateUrl: './object-annotation-history.component.html',
})
export class ObjectAnnotationHistoryComponent {

  _object: FilesystemObject;
  page = 1;
  @Input() limit = 20;
  logWithStatus$: Observable<PipeStatus<FileAnnotationHistory>> = from([]);

  protected subscriptions = new Subscription();

  constructor(protected readonly filesystemService: FilesystemService,
              protected readonly errorHandler: ErrorHandler) {
  }

  @Input()
  set object(value: FilesystemObject | undefined) {
    this._object = value;
    this.refresh();
  }

  get object() {
    return this._object;
  }

  refresh() {
    this.logWithStatus$ = (this.object ? this.filesystemService.getAnnotationHistory(this.object.hashId, {
      page: this.page,
      limit: this.limit,
    }).pipe(
      this.errorHandler.create({label: 'Refresh file annotation history'}),
    ) : from([])).pipe(
      addStatus(new FileAnnotationHistory().update(fileAnnotationHistoryResponseLoadingMock())),
    );
  }

  goToPage(page: number) {
    this.page = page;
    this.refresh();
  }

}
