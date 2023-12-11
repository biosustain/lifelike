import { Component, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ProjectImpl } from 'app/file-browser/models/filesystem-object';
import { ProjectActions } from 'app/file-browser/services/project-actions';
import { DirectoryTypeProvider } from 'app/file-types/providers/directory.type-provider';
import { AuthenticationService } from 'app/auth/services/authentication.service';

import { ErrorHandler } from '../../services/error-handler.service';

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
export class ProjectMenuComponent {
  encodeURIComponent = encodeURIComponent;

  @Input() project: ProjectImpl;
  @Input() nameEntity = false;

  constructor(
    protected readonly projectActions: ProjectActions,
    protected readonly errorHandler: ErrorHandler,
    protected readonly snackBar: MatSnackBar,
    protected readonly directoryTypeProvider: DirectoryTypeProvider,
    protected readonly authService: AuthenticationService
  ) {}

  openEditDialog(project: ProjectImpl) {
    this.projectActions.openEditDialog(project);
  }

  openCollaboratorsDialog(project: ProjectImpl) {
    this.projectActions.openCollaboratorsDialog(project);
  }

  openDeleteDialog(project: ProjectImpl) {
    return this.projectActions
      .openDeleteDialog(project)
      .then(() => this.snackBar.open(`Deleted ${project.name}.`, 'Close', { duration: 5000 }));
  }

  openShareDialog(project: ProjectImpl) {
    this.projectActions.openShareDialog(project);
  }

  updateStarred(project: ProjectImpl, starred: boolean) {
    return this.projectActions.updateStarred(project, starred);
  }
}
