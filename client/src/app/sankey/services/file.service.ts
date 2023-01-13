import { Injectable } from '@angular/core';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyFile } from '../model/sankey-document';

/**
 * Ultimately only one instance maintaining or open sankey files or all files in general.
 */
@Injectable()
export class SankeyFileService {
  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly warningController: WarningControllerService
  ) {}

  get(hashId: string) {
    return new SankeyFile(this.filesystemService, this.warningController, hashId);
  }
}
