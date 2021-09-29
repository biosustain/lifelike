import { Injectable, Injector, OnDestroy } from '@angular/core';

import { zip, Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { FilesystemObject } from '../models/filesystem-object';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { FilesystemService } from './filesystem.service';
import { FilesystemObjectData } from '../schema';

export class RecentFileHashesService implements OnDestroy {
  private readonly RECENT_KEY = '***ARANGO_DB_NAME***_workspace_recentList';
  private readonly storage = localStorage;
  hashes: BehaviorSubject<string[]>;

  constructor() {
    const hashes = this.fetchHashes();
    this.hashes = new BehaviorSubject<string[]>(hashes);
    this.hashes.subscribe(() => this.saveHashes());
    this.startWatchingStorage();
  }

  private startWatchingStorage(): void {
    window.addEventListener('storage', this.storageEventListener.bind(this));
  }

  private stopWatchingStorage(): void {
    window.removeEventListener('storage', this.storageEventListener.bind(this));
  }

  private storageEventListener(event: StorageEvent) {
    if (
      event.storageArea === localStorage &&
      event.key === this.RECENT_KEY
    ) {
      this.setHashes(this.fetchHashes());
    }
  }

  deleteFromHashes(hashId: string) {
    const hashes = this.hashes.value;
    const idx = hashes.indexOf(hashId);
    if (idx !== -1) {
      hashes.splice(idx, 1);
    }
    this.setHashes(hashes);
  }

  setHashes(hashes) {
    this.hashes.next(hashes.slice(0, 20));
  }

  addToHashes(hashId: string) {
    const hashes = this.hashes.value;
    const idx = hashes.indexOf(hashId);
    if (idx !== -1) {
      hashes.splice(idx, 1);
    }
    hashes.unshift(hashId);
    this.setHashes(hashes);
  }

  fetchHashes(): string[] {
    const strValue = this.storage.getItem(this.RECENT_KEY);
    return JSON.parse(strValue);
  }

  saveHashes(): void {
    const fileHashes = this.hashes.value;
    const strValue = JSON.stringify(fileHashes);
    this.storage.setItem(this.RECENT_KEY, strValue);
  }

  ngOnDestroy() {
    this.stopWatchingStorage();
    this.saveHashes();
  }
}


@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class RecentFilesService extends RecentFileHashesService implements OnDestroy {
  list: Observable<FilesystemObject[]>;
  loadTask;
  fileObjects = new Map();

  constructor(
    protected readonly injector: Injector
  ) {
    super();
    this.loadTask = new BackgroundTask<string[], FilesystemObject[]>((fileHashes: string[]) => {
      const filesystemService = this.injector.get<FilesystemService>(FilesystemService);
      return zip(
        ...fileHashes.map(fileHash =>
          filesystemService.get(fileHash).pipe(
            catchError(() => {
              // if file does not exist, delete from list
              this.deleteFromHashes(fileHash);
              return of(undefined);
            })
          )
        )
      );
    });
    this.hashes.subscribe(hashes => {
      const newHashes = hashes.filter(hash => !this.fileObjects.has(hash));
      if (newHashes.length) {
        this.loadTask.update(hashes);
      }
    });
    this.list = this.hashes.pipe(
      map(hashes => {
        return hashes.map(hash => this.fileObjects.get(hash)).filter(fileObj => fileObj);
      })
    );
  }

  addToList(fileObj: FilesystemObject) {
    if (!fileObj.isDirectory) {
      const {hashId} = fileObj;
      this.fileObjects.set(hashId, fileObj);
      this.addToHashes(hashId);
    }
  }

  deleteFromList({hashId}: FilesystemObject | FilesystemObjectData) {
    this.fileObjects.delete(hashId);
    this.deleteFromHashes(hashId);
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
