import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { openDownloadForBlob } from 'app/shared/utils/files';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';

import { FilesystemService } from '../services/filesystem.service';
import { FilesystemObject } from '../models/filesystem-object';
import { getObjectLabel } from '../utils/objects';
import { FileService } from '../services/file.service';

@Component({
  selector: 'app-file-viewer',
  templateUrl: 'file-viewer.component.html',
  providers: [
    FileService
  ]
})
export class FileViewerComponent {
  constructor(protected readonly file: FileService) {
    console.log('opened file view');
  }

  object$ = this.file.object$;
  status$ = this.file.status$;
}
