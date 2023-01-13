import { Component, OnDestroy, OnInit } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { mergeMap, shareReplay, startWith, switchMap, map } from 'rxjs/operators';
import { select } from '@ngrx/store';
import { isNil } from 'lodash-es';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { PaginatedRequestOptions } from 'app/shared/schemas/common';
import { addStatus, PipeStatus } from 'app/shared/pipes/add-status.pipe';
import { projectImplLoadingMock } from 'app/shared/mocks/loading/file';
import { mockArrayOf } from 'app/shared/mocks/loading/utils';

import { ProjectsService } from '../../services/projects.service';
import { ProjectActions } from '../../services/project-actions';
import { ProjectList } from '../../models/project-list';
import { ProjectImpl } from '../../models/filesystem-object';
import { FilesystemService } from '../../services/filesystem.service';

@Component({
  selector: 'app-browser-project-list',
  templateUrl: './browser-project-list.component.html',
})
export class BrowserProjectListComponent {
  readonly paging$ = new BehaviorSubject<PaginatedRequestOptions>({
    page: 1,
    limit: 50,
    sort: 'name',
  });
  readonly projectList$: Observable<PipeStatus<ProjectList>> = this.paging$.pipe(
    switchMap((options) => this.projectService.list(options)),
    addStatus(new ProjectList(mockArrayOf(projectImplLoadingMock))),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    protected readonly projectService: ProjectsService,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly filesystemService: FilesystemService,
    protected readonly projectActions: ProjectActions
  ) {}

  openCreateDialog() {
    this.projectActions.openCreateDialog().then(
      (project) => {
        this.workspaceManager.navigate(project.getCommands());
      },
      () => {}
    );
  }

  projectDragStart(event: DragEvent, project: ProjectImpl) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    project.addDataTransferData(dataTransfer);
  }

  toggleStarred(project: ProjectImpl) {
    return this.projectActions.updateStarred(project, isNil(project.starred));
  }
}
