import { Component, OnDestroy, OnInit } from '@angular/core';
import { Project, ProjectSpaceService } from '../services/project-space.service';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { ProjectEditDialogComponent } from './project-edit-dialog.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription } from 'rxjs';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { CollectionModal } from '../../shared/utils/collection-modal';

@Component({
  selector: 'app-project-space',
  templateUrl: './project-browser.component.html',
})
export class ProjectBrowserComponent implements OnInit, OnDestroy {

  readonly loadTask: BackgroundTask<void, Project[]> = new BackgroundTask(
    () => this.projectSpaceService.getProject(),
  );
  private loadTaskSubscription: Subscription;

  readonly results = new CollectionModal<Project>([], {
    multipleSelection: true,
    sort: (a: Project, b: Project) => {
      return a.projectName.localeCompare(b.projectName);
    },
  });

  constructor(private readonly projectSpaceService: ProjectSpaceService,
              private readonly workspaceManager: WorkspaceManager,
              private readonly progressDialog: ProgressDialog,
              private readonly ngbModal: NgbModal) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: projects}) => {
      this.results.replace(projects);
    });

    this.refresh();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update();
  }

  private normalizeFilter(filter: string): string {
    return filter.trim().toLowerCase().replace(/[ _]+/g, ' ');
  }

  applyFilter(filter: string) {
    const normalizedFilter = this.normalizeFilter(filter);
    this.results.filter = normalizedFilter.length ? (item: Project) => {
      return this.normalizeFilter(item.projectName).includes(normalizedFilter);
    } : null;
  }

  displayCreateDialog() {
    const dialogRef = this.ngbModal.open(ProjectCreateDialogComponent);

    dialogRef.result.then(
      newProject => {
        this.results.push(newProject);
        this.goToProject(newProject);
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
