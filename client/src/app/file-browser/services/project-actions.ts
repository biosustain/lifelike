import { Injectable } from '@angular/core';
import { ProjectService } from './project.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProjectImpl } from '../models/filesystem-object';
import { ShareDialogComponent } from '../../shared/components/dialog/share-dialog.component';
import { ProjectEditDialogComponent, ProjectEditDialogValue } from '../components/dialog/project-edit-dialog.component';
import { ProjectCreateRequest } from '../schema';
import { BehaviorSubject } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { finalize } from 'rxjs/operators';
import { ProjectCollaboratorsDialogComponent } from '../components/dialog/project-collaborators-dialog.component';

@Injectable()
export class ProjectActions {

  constructor(protected readonly projectService: ProjectService,
              protected readonly modalService: NgbModal,
              protected readonly messageDialog: MessageDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly progressDialog: ProgressDialog) {
  }

  protected createProgressDialog(message: string, title = 'Working...') {
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: message,
    }));
    return this.progressDialog.display({
      title,
      progressObservable,
    });
  }

  /**
   * Open a dialog to create a project.
   */
  openCreateDialog(options: CreateDialogOptions = {}): Promise<ProjectImpl> {
    const project = new ProjectImpl();
    const dialogRef = this.modalService.open(ProjectEditDialogComponent);
    dialogRef.componentInstance.title = options.title || 'New Project';
    dialogRef.componentInstance.project = project;
    dialogRef.componentInstance.accept = ((value: ProjectEditDialogValue) => {
      const progressDialogRef = this.createProgressDialog('Creating project...');
      return this.projectService.create({
        ...value.request,
        ...(options.request || {}),
      }).pipe(
        finalize(() => progressDialogRef.close()),
        this.errorHandler.create(),
      ).toPromise();
    });
    return dialogRef.result;
  }

  /**
   * Open a dialog to edit a project.
   * @param project the project to edit
   */
  openEditDialog(project: ProjectImpl): Promise<ProjectImpl> {
    const dialogRef = this.modalService.open(ProjectEditDialogComponent);
    dialogRef.componentInstance.project = project;
    dialogRef.componentInstance.accept = ((value: ProjectEditDialogValue) => {
      const progressDialogRef = this.createProgressDialog(`Saving changes to '${project.name}'...`);
      return this.projectService.save([project.hashId], value.request, {
        [project.hashId]: project,
      })
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create(),
        )
        .toPromise();
    });
    return dialogRef.result;
  }

  /**
   * Open a dialog to modify a project's collaborators.
   * @param project the project to edit
   */
  openCollaboratorsDialog(project: ProjectImpl): Promise<any> {
    const dialogRef = this.modalService.open(ProjectCollaboratorsDialogComponent);
    dialogRef.componentInstance.project = project;
    return dialogRef.result;
  }

  openShareDialog(project: ProjectImpl): Promise<any> {
    const modalRef = this.modalService.open(ShareDialogComponent);
    modalRef.componentInstance.url = `${window.location.origin}/${project.getURL()}`;
    return modalRef.result;
  }

}

export class CreateDialogOptions {
  title?: string;
  request?: Partial<ProjectCreateRequest>;
}
