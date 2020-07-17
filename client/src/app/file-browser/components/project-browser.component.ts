import { Component, OnDestroy, OnInit } from '@angular/core';
import { Project, ProjectSpaceService } from '../services/project-space.service';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { ProjectEditDialogComponent } from './project-edit-dialog.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription } from 'rxjs';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';

@Component({
  selector: 'app-project-space',
  templateUrl: './project-browser.component.html',
})
export class ProjectBrowserComponent implements OnInit, OnDestroy {

  readonly loadTask: BackgroundTask<void, Project[]> = new BackgroundTask(
    () => this.projectSpaceService.getProject(),
  );
  private loadTaskSubscription: Subscription;
  projects: Project[] = [];

  constructor(private readonly projectSpaceService: ProjectSpaceService,
              private readonly workspaceManager: WorkspaceManager,
              private readonly progressDialog: ProgressDialog,
              private readonly ngbModal: NgbModal) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: projects}) => {
      this.projects = projects;
    });

    this.refresh();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update();
  }

  displayCreateDialog() {
    const dialogRef = this.ngbModal.open(ProjectCreateDialogComponent);

    dialogRef.result.then(
      newProject => {
        this.projects.push(newProject);
      },
      () => {
      },
    );
  }

  displayShareDialog(project: Project) {
    const dialogRef = this.ngbModal.open(ProjectEditDialogComponent);
    dialogRef.componentInstance.project = project;
  }

  goToProject(p: Project) {
    const projectName = encodeURIComponent(p.projectName);
    this.workspaceManager.navigateByUrl(`/projects/${projectName}`);
  }
}
