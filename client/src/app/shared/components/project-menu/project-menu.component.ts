import { Component, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ProjectActions } from 'app/file-browser/services/project-actions';

@Component({
  selector: 'app-project-menu',
  templateUrl: './project-menu.component.html',
})
export class ProjectMenuComponent {

  @Input() project: FilesystemObject;
  @Input() nameEntity = false;

  constructor(protected readonly projectActions: ProjectActions,
              protected readonly snackBar: MatSnackBar) {
  }

  openEditDialog(project: FilesystemObject) {
    this.projectActions.openEditDialog(project);
  }

  openCollaboratorsDialog(project: FilesystemObject) {
    this.projectActions.openCollaboratorsDialog(project);
  }

  openDeleteDialog(project: FilesystemObject) {
    return this.projectActions.openDeleteDialog(project)
      .then(() =>
        this.snackBar.open(
          `Deleted ${project.filename}.`,
          'Close', {duration: 5000}
        )
      );
  }

  openShareDialog(project: FilesystemObject) {
    this.projectActions.openShareDialog(project);
  }

  updateStarred(project: FilesystemObject, starred: boolean) {
    return this.projectActions.updateStarred(project, starred);
  }
}
