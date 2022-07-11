import { Injectable } from '@angular/core';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { GraphFile } from 'app/shared/providers/graph-type/interfaces';

import { SankeyFile } from '../model/sankey-document';
import { ErrorMessages } from '../constants/error';

/**
 * Ultimately only one instance maintaining or open sankey files or all files in general.
 */
@Injectable()
export class SankeyFileService {
  constructor(
    protected readonly filesystemService: FilesystemService
  ) {
  }

  get(hashId: string) {
    return new SankeyFile(this.filesystemService, hashId);
  }
}
