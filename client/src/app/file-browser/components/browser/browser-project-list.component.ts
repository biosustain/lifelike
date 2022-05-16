import { Component, OnDestroy, OnInit } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { mergeMap, shareReplay, switchMap } from 'rxjs/operators';
import { select } from '@ngrx/store';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { PaginatedRequestOptions } from 'app/shared/schemas/common';
import { addStatus, PipeStatus } from 'app/shared/pipes/add-status.pipe';
import { AuthSelectors } from 'app/auth/store';

import { ProjectsService } from '../../services/projects.service';
import { ProjectActions } from '../../services/project-actions';
import { ProjectList } from '../../models/project-list';
import { ProjectImpl } from '../../models/filesystem-object';

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
    switchMap(options => addStatus(this.projectService.list(options))),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(protected readonly projectService: ProjectsService,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly projectActions: ProjectActions) {
  }

  openCreateDialog() {
    this.projectActions.openCreateDialog().then(project => {
      this.workspaceManager.navigate(project.getCommands());
    }, () => {
    });
  }

  projectDragStart(event: DragEvent, project: ProjectImpl) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    project.addDataTransferData(dataTransfer);
  }
}
