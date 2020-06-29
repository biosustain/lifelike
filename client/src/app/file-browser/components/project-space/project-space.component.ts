import { Component, OnInit, HostBinding } from '@angular/core';
import {
  ProjectSpaceService,
  Project
} from '../../services/project-space.service';

import {
  NgbModal
} from '@ng-bootstrap/ng-bootstrap';

import {
  CreateProjectDialogComponent
} from '../create-project-dialog/create-project-dialog.component';
import {
  EditProjectDialogComponent
} from '../edit-project-dialog/edit-project-dialog.component';
import { Router } from '@angular/router';


// TODO - Sort projects meaningfully: name or modified_data
// TODO - Add URL parameter that goes by project space & directory-id
// TODO - capture error for duplicate project name
// TODO - toggle between list and grid view

@Component({
  selector: 'app-project-space',
  templateUrl: './project-space.component.html',
  styleUrls: ['./project-space.component.scss']
})
export class ProjectSpaceComponent implements OnInit {

  selectedProject: Project;

  projects: Project[] = [];

  @HostBinding('class.bg-grey') childPosition = true;

  constructor(
    private projSpace: ProjectSpaceService,
    private ngbModal: NgbModal,
    private route: Router
  ) {
    this.projSpace.getProject()
      .subscribe(projects => {
        this.projects = projects;
      });
  }

  ngOnInit() {

  }

  createProject() {
    const dialogRef = this.ngbModal.open(CreateProjectDialogComponent);

    dialogRef.result.then(
      projectMeta => {
        this.projSpace.createProject(projectMeta)
          .subscribe(
            newProject => this.projects.push(newProject)
          );
      },
      () => {
      }
    );
  }

  editProject(project: Project) {

    const dialogRef = this.ngbModal.open(EditProjectDialogComponent);
    dialogRef.componentInstance.project = project;

    // TODO - do we need a callback after closing modal
    dialogRef.result.then(
      () => {},
      () => {}
    );
  }

  goToProject(p: Project) {
    this.route.navigateByUrl(
      `ps/${p.projectName}`
    );
  }
}
