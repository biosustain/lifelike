import { Component, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { finalize } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProjectImpl, FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ProjectActions } from 'app/file-browser/services/project-actions';
import { ObjectDeleteDialogComponent } from 'app/file-browser/components/dialog/object-delete-dialog.component';
import { getObjectLabel } from 'app/file-browser/utils/objects';

@Component({
  selector: 'app-project-menu',
  templateUrl: './project-menu.component.html',
})
export class ProjectMenuComponent {

  @Input() project: ProjectImpl;
  @Input() nameEntity = false;
  @Input() showTools = true;

  constructor(protected readonly projectActions: ProjectActions,
              protected readonly snackBar: MatSnackBar) {
  }

  openEditDialog(project: ProjectImpl) {
    this.projectActions.openEditDialog(project);
  }

  openCollaboratorsDialog(project: ProjectImpl) {
    this.projectActions.openCollaboratorsDialog(project);
  }

  openDeleteDialog(project: ProjectImpl) {
    return this.projectActions.openDeleteDialog(project)
      .then(() =>
        this.snackBar.open(
          `Deleted ${project.name}.`,
          'Close', {duration: 5000}
        )
      );
  }

  openShareDialog(project: ProjectImpl) {
    this.projectActions.openShareDialog(project);
  }
}
