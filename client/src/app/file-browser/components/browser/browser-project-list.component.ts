import { Component, OnDestroy, OnInit } from '@angular/core';
import { Project, ProjectSpaceService } from '../../services/project-space.service';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProjectCreateDialogComponent } from '../project-create-dialog.component';
import { ProjectEditDialogComponent } from '../project-edit-dialog.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { combineLatest, Subscription } from 'rxjs';
import { WorkspaceManager } from '../../../shared/workspace-manager';
import { ProgressDialog } from '../../../shared/services/progress-dialog.service';
import { CollectionModal } from '../../../shared/utils/collection-modal';
import { MapService } from '../../../drawing-tool/services';
import { ResultList, StandardRequestOptions } from '../../../interfaces/shared.interface';
import { PublicMap } from '../../../drawing-tool/services/map.service';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-browser-project-list',
  templateUrl: './browser-project-list.component.html',
})
export class BrowserProjectListComponent implements OnInit, OnDestroy {
  private readonly defaultLocator: StandardRequestOptions = {
    limit: 100,
    page: 1,
    sort: '+name',
  };
  public readonly loadTask: BackgroundTask<void, Project[]> = new BackgroundTask(
    () => this.projectSpaceService.getProject(),
  );

  public locator: StandardRequestOptions = {
    ...this.defaultLocator,
  };

  public readonly filterForm: FormGroup = new FormGroup({
    q: new FormControl(''),
    limit: new FormControl(100),
  });

  public collectionSize = 0;
  public readonly results = new CollectionModal<Project>([], {
    multipleSelection: true,
  });

  private loadTaskSubscription: Subscription;

  constructor(private readonly projectSpaceService: ProjectSpaceService,
              private readonly mapService: MapService,
              private readonly workspaceManager: WorkspaceManager,
              private readonly progressDialog: ProgressDialog,
              private readonly ngbModal: NgbModal) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: projects}) => {
      this.collectionSize = projects.length;
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

  search() {
    this.locator = {
      ...this.defaultLocator,
      ...this.locator,
      q: this.filterForm.value.q,
    };

    const normalizedFilter = this.normalizeFilter(this.locator.q);
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
