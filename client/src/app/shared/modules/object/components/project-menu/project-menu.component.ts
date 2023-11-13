import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Observable, ReplaySubject, Subject } from 'rxjs';
import { mergeMap, shareReplay } from 'rxjs/operators';

import { ProjectImpl } from 'app/file-browser/models/filesystem-object';
import { ProjectActions } from 'app/file-browser/services/project-actions';
import { Exporter } from 'app/file-types/providers/base-object.type-provider';
import { DirectoryTypeProvider } from 'app/file-types/providers/directory.type-provider';

import { ErrorHandler } from '../../../../services/error-handler.service';

@Component({
  selector: 'app-project-menu',
  templateUrl: './project-menu.component.html',
  providers: [
    {
      provide: DirectoryTypeProvider,
      useClass: DirectoryTypeProvider,
    },
  ],
})
export class ProjectMenuComponent implements OnChanges {
  encodeURIComponent = encodeURIComponent;

  constructor(
    protected readonly projectActions: ProjectActions,
    protected readonly errorHandler: ErrorHandler,
    protected readonly snackBar: MatSnackBar,
    protected readonly directoryTypeProvider: DirectoryTypeProvider
  ) {}

  @Input() project: ProjectImpl;
  @Input() nameEntity = false;
  private readonly project$: Subject<ProjectImpl> = new ReplaySubject(1);
  readonly exporters$: Observable<Exporter[]> = this.project$.pipe(
    this.errorHandler.create({ label: 'Get exporters' }),
    mergeMap((project) => this.directoryTypeProvider.getExporters(project.***ARANGO_USERNAME***)),
    shareReplay()
  );

  ngOnChanges({ project }: SimpleChanges) {
    if (project) {
      this.project$.next(project.currentValue);
    }
  }

  openEditDialog(project: ProjectImpl) {
    this.projectActions.openEditDialog(project);
  }

  openCollaboratorsDialog(project: ProjectImpl) {
    this.projectActions.openCollaboratorsDialog(project);
  }

  async openDeleteDialog(project: ProjectImpl) {
      await this.projectActions
                .openDeleteDialog(project);
      return this.snackBar.open(`Deleted ${ project.name }.`, 'Close', { duration: 5000 });
  }

  openShareDialog(project: ProjectImpl) {
    this.projectActions.openShareDialog(project);
  }

  updateStarred(project: ProjectImpl, starred: boolean) {
    return this.projectActions.updateStarred(project, starred);
  }

  openExportDialog(target: ProjectImpl) {
    return this.projectActions.openExportDialog(target);
  }
}
