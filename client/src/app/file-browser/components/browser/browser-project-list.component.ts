import { Component, OnDestroy, OnInit } from '@angular/core';
import { Project } from '../../services/project-space.service';

// @ts-ignore
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription } from 'rxjs';
import { WorkspaceManager } from '../../../shared/workspace-manager';
import { ProgressDialog } from '../../../shared/services/progress-dialog.service';
import { CollectionModel } from '../../../shared/utils/collection-model';
import { FormControl, FormGroup } from '@angular/forms';
import { ProjectsService } from '../../services/projects.service';
import { map } from 'rxjs/operators';
import { ProjectImpl } from '../../models/filesystem-object';
import { ProjectActions } from '../../services/project-actions';
import { StandardRequestOptions } from '../../../shared/schemas/common';

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
  public readonly loadTask: BackgroundTask<void, ProjectImpl[]> = new BackgroundTask(
    () => this.projectService.list().pipe(map(projectList => {
      return [...projectList.results.items];
    })),
  );

  public locator: StandardRequestOptions = {
    ...this.defaultLocator,
  };

  public readonly filterForm: FormGroup = new FormGroup({
    q: new FormControl(''),
    limit: new FormControl(100),
  });

  public collectionSize = 0;
  public readonly results = new CollectionModel<ProjectImpl>([], {
    multipleSelection: true,
  });

  private loadTaskSubscription: Subscription;

  constructor(protected readonly projectService: ProjectsService,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly progressDialog: ProgressDialog,
              protected readonly ngbModal: NgbModal,
              protected readonly projectActions: ProjectActions) {
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

  openCreateDialog() {
    this.projectActions.openCreateDialog().then(project => {
      this.workspaceManager.navigate(project.getCommands());
    }, () => {
    });
  }

  goToProject(p: Project) {
    const projectName = encodeURIComponent(p.projectName);
    this.workspaceManager.navigateByUrl(`/projects/${projectName}`);
  }
}
