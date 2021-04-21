import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { BulkObjectUpdateRequest } from '../../file-browser/schema';
import { tap, shareReplay, map } from 'rxjs/operators';

const openEnrichmentFiles = new Map();

@Injectable()
export class EnrichmentService implements OnDestroy {
  constructor(protected readonly filesystemService: FilesystemService) {}

  getFileRef(hashId: string) {
    let openFile = openEnrichmentFiles.get(hashId);
    if (!openFile) {
      openFile = {
        get: this.filesystemService.get(hashId).pipe(map(Object.freeze), shareReplay(1)),
        getContent: this.filesystemService.getContent(hashId).pipe(map(Object.freeze), shareReplay(1)),
        ref: new Set()
      };
      openEnrichmentFiles.set(hashId, openFile);
    }
    openFile.ref.add(this);
    return openFile;
  }

  get(hashId: string): Observable<FilesystemObject> {
    return this.getFileRef(hashId).get;
  }

  getContent(hashId: string): Observable<Blob> {
    return this.getFileRef(hashId).getContent;
  }

  ngOnDestroy() {
    openEnrichmentFiles.forEach((file, hashId, fileMap) =>
      file.ref.delete(this) && !file.ref.size && fileMap.delete(hashId)
    );
  }

  save(hashIds: string[], changes: Partial<BulkObjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: FilesystemObject }):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.filesystemService.save(hashIds, changes, updateWithLatest).pipe(tap(ret =>
      hashIds.forEach(hashId => this.getFileRef(hashId).get = ret[hashId])
    ));
  }
}
