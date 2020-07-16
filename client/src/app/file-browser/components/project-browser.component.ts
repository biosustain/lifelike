import { Component, OnInit } from '@angular/core';
import {
  ProjectSpaceService,
  Project,
} from '../services/project-space.service';

import {
  NgbModal,
} from '@ng-bootstrap/ng-bootstrap';

import {
  ProjectCreateDialogComponent,
} from './project-create-dialog.component';
import {
  ProjectEditDialogComponent,
} from './project-edit-dialog.component';
import { Router } from '@angular/router';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription } from 'rxjs';


// TODO - Sort projects meaningfully: name or modified_data
// TODO - Add URL parameter that goes by project space & directory-id
// TODO - capture error for duplicate project name
// TODO - toggle between list and grid view

@Component({
  selector: 'app-project-space',
  templateUrl: './project-browser.component.html',
  styleUrls: ['./project-browser.component.scss'],
})
export class ProjectBrowserComponent implements OnInit {

  selectedProject: Project;
  projects: Project[] = [];

  loadTask: BackgroundTask<void, Project[]> = new BackgroundTask(
    () => this.projSpace.getProject(),
  );
  loadTaskSubscription: Subscription;


  constructor(
    private projSpace: ProjectSpaceService,
    private ngbModal: NgbModal,
    private route: Router,
  ) {
    this.refresh();
  }

  ngOnInit() {
    this.loadTask.results$.subscribe(
      ({
         result: projects,
       }) => {
        this.projects = projects;
      },
    );
  }

  refresh() {
    this.loadTask.update();
  }

  createProject() {
    const dialogRef = this.ngbModal.open(ProjectCreateDialogComponent);

    dialogRef.result.then(
      newProject => {
        this.projects.push(newProject);
      },
      () => {
      },
    );
  }

  editProject(project: Project) {

    const dialogRef = this.ngbModal.open(ProjectEditDialogComponent);
    dialogRef.componentInstance.project = project;
  }

  goToProject(p: Project) {
    const projectName = encodeURIComponent(p.projectName);
    this.route.navigateByUrl(
      `projects/${projectName}`,
    );
  }
}
