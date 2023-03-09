import { Component, Input } from "@angular/core";

import { from, Observable, Subscription } from "rxjs";

import { ErrorHandler } from "app/shared/services/error-handler.service";

import { FileAnnotationHistory } from "../models/file-annotation-history";
import { FilesystemService } from "../services/filesystem.service";
import { FilesystemObject } from "../models/filesystem-object";

@Component({
  selector: "app-object-annotation-history",
  templateUrl: "./object-annotation-history.component.html",
})
export class ObjectAnnotationHistoryComponent {
  page = 1;
  @Input() limit = 20;
  log$: Observable<FileAnnotationHistory> = from([]);
  protected subscriptions = new Subscription();

  _object: FilesystemObject;

  get object() {
    return this._object;
  }

  @Input()
  set object(value: FilesystemObject | undefined) {
    this._object = value;
    this.refresh();
  }

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly errorHandler: ErrorHandler
  ) {}

  refresh() {
    this.log$ = this.object
      ? this.filesystemService
          .getAnnotationHistory(this.object.hashId, {
            page: this.page,
            limit: this.limit,
          })
          .pipe(this.errorHandler.create({ label: "Refresh file annotation history" }))
      : from([]);
  }

  goToPage(page: number) {
    this.page = page;
    this.refresh();
  }
}
