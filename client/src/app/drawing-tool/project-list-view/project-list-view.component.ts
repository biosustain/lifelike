import { Component, OnInit, AfterViewInit, ViewChild, TemplateRef, ViewContainerRef } from '@angular/core';
import {
  MatDialog
} from '@angular/material/dialog';
import { Router } from '@angular/router';
import { OverlayRef, Overlay } from '@angular/cdk/overlay';
import { Subscription, Observable, fromEvent } from 'rxjs';
import { TemplatePortal } from '@angular/cdk/portal';
import { filter, take } from 'rxjs/operators';

import {
  ProjectsService,
  DataFlowService,
  uuidv4
} from '../services';
import {
  Project
} from '../services/interfaces';
import {
  NetworkVis
} from '../network-vis';
import {
  CreateProjectDialogComponent
} from './create-project-dialog/create-project-dialog.component';
import {
  DeleteProjectDialogComponent
} from './delete-project-dialog/delete-project-dialog.component';
import {
  CopyProjectDialogComponent
} from './copy-project-dialog/copy-project-dialog.component';

declare var $: any;

@Component({
  selector: 'app-project-list-view',
  templateUrl: './project-list-view.component.html',
  styleUrls: ['./project-list-view.component.scss']
})
export class ProjectListViewComponent implements OnInit, AfterViewInit {

  projects: Project[] = [];

  selectedProject = null;

  vis_graph = null;

  @ViewChild('projectMenu', {static: false}) projectMenu: TemplateRef<any>;
  overlayRef: OverlayRef | null;
  sub: Subscription;

  constructor(
    public dialog: MatDialog,
    private route: Router,
    private projectService: ProjectsService,
    private dataFlow: DataFlowService,
    public overlay: Overlay,
    public viewContainerRef: ViewContainerRef
  ) { }

  ngOnInit() {

  }

  ngAfterViewInit() {
    this.projectService.pullProjects()
      .subscribe(data => {
        this.projects = data['projects'] as Project[];

        // Sort project by most recent modified date
        this.projects.sort(
          (a, b) => {
            return (a.date_modified < b.date_modified) ? -1 : ((a.date_modified > b.date_modified) ? 1 : 0);
          }
        );
        this.projects.reverse();
      });
  }

  open(event: MouseEvent, project) {
    event.preventDefault();

    let x = event.x,
      y = event.y;

    this.close();
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo({ x, y })
      .withPositions([
        {
          originX: 'end',
          originY: 'bottom',
          overlayX: 'end',
          overlayY: 'top',
        }
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });

    this.overlayRef.attach(new TemplatePortal(this.projectMenu, this.viewContainerRef, {
      $implicit: project
    }));

    this.sub = fromEvent<MouseEvent>(document, 'click')
      .pipe(
        filter(event => {
          const clickTarget = event.target as HTMLElement;
          
          let isRightClick = false;
          if ("which" in event) {
            isRightClick = event["which"] == 3;
          } else if ("button" in event) {
            isRightClick = event["button"] == 2;
          }

          return !!this.overlayRef && !this.overlayRef.overlayElement.contains(clickTarget);
        }),
        take(1)
      ).subscribe(() => this.close())
  }
  close() {
    this.sub && this.sub.unsubscribe();
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }    
  }

  goToProject() {
    this.dataFlow.pushProject2Canvas(this.selectedProject);
    this.route.navigateByUrl('drawing-tool');
  }

  pickProject(proj: Project) {
    if (this.overlayRef) return;

    this.selectedProject = proj;

    $('.list-view').animate({
      width: '60%'
    }, 400, () => {});

    let container = document.getElementById('canvas');
    this.vis_graph = new NetworkVis(container);

    let g = this.projectService.universe2Vis(proj.graph);

    setTimeout(
      () => {
        this.vis_graph.draw(
          g.nodes,
          g.edges
        );
      },
      100
    )
  }

  copyProject(project) {
    // TODO: Add project into data attr
    const dialogRef = this.dialog.open(CopyProjectDialogComponent, {
      width: '40%',
      data: project
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.projectService.addProject(result)
        .subscribe((data) => {
          this.projects.push(data['project']);
        });
    });
  }

  createProject() {
    const dialogRef = this.dialog.open(CreateProjectDialogComponent, {
      width: '40%',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        let project = {
          ...result,
          graph: {
            nodes: [],
            edges: []
          },
          date_modified: new Date().toISOString()
        };

        this.projectService.addProject(project)
          .subscribe((data) => {
            this.projects.push(data['project']);
          });
      }
    });    
  }

  deleteProject(project=null) {
    if (!project) project = this.selectedProject;

    const dialogRef = this.dialog.open(DeleteProjectDialogComponent, {
      width: '40%',
      data: project
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.projectService.deleteProject(project)
          .subscribe(resp => {

            this.projects = this.projects.filter(p => p.id !== project.id);

            if (project === this.selectedProject) {
              this.selectedProject = null;


              $('.list-view').animate({
                width: '100%'
              }, 400, () => {});
            }
          });
      }
    });      
  }

  /**
   * Open the project in pdf-viewer view
   * @param project 
   */
  openPDFViewer(project) {
    this.dataFlow.pushProject2Canvas(project);
    this.route.navigateByUrl('pdf-viewer');
  }
}
