import { Injectable, OnDestroy } from '@angular/core';
import { FilesystemObject, PathLocator } from '../models/filesystem-object';
import { from, Observable, Subscription } from 'rxjs';
import { FilesystemService } from './filesystem.service';
import { map } from 'rxjs/operators';
import { ProjectSpaceService } from './project-space.service';
import { ProjectList } from '../models/project-list';

@Injectable()
export class ObjectSelectService implements OnDestroy {
  multipleSelection = false;
  objectFilter: (item: FilesystemObject) => boolean;

  locator: PathLocator;
  projectList$: Observable<ProjectList> = from([]);
  object$: Observable<FilesystemObject> = from([]);
  projectList: ProjectList;
  object: FilesystemObject;

  private annotationSubscription: Subscription;

  constructor(private readonly projectSpaceService: ProjectSpaceService,
              private readonly filesystemService: FilesystemService) {
    this.load(null);
  }

  ngOnDestroy(): void {
    if (this.annotationSubscription) {
      this.annotationSubscription.unsubscribe();
      this.annotationSubscription = null;
    }
  }

  private applyInput() {
    if (this.object != null) {
      this.object.children.multipleSelection = this.multipleSelection;
      this.object.children.filter = this.objectFilter;
    }
  }

  load(locator?: PathLocator): Observable<any> {
    this.locator = locator;
    this.projectList$ = from([]);
    this.object$ = from([]);
    this.projectList = null;
    this.object = null;

    if (locator == null) {
      const projectList$ = this.projectSpaceService.getProject().pipe(map(projects => {
        const projectList = new ProjectList();
        projectList.collectionSize = projects.length;
        projectList.results.replace(projects);
        this.projectList = projectList;
        return projectList;
      }));
      this.projectList$ = projectList$;
      return projectList$;
    } else {
      const object$ = this.filesystemService.get({
        projectName: locator.projectName,
        directoryId: locator.directoryId,
      }).pipe(map(object => {
        if (this.annotationSubscription) {
          this.annotationSubscription.unsubscribe();
          this.annotationSubscription = null;
        }
        this.annotationSubscription = this.filesystemService.annotate(object);
        this.object = object;
        this.applyInput();
        return object;
      }));
      this.object$ = object$;
      return object$;
    }
  }

  open(target: FilesystemObject) {
    if (target.type === 'dir') {
      this.load(target.locator);
    }
  }

  goUp() {
    if (this.object != null) {
      if (this.object.path.length === 1) {
        this.load(null);
      } else {
        this.load({
          projectName: this.object.locator.projectName,
          directoryId: this.object.directory.directoryParentId + '',
        });
      }
    }
  }
}
