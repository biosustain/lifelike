import { AfterViewInit, Component, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Project } from 'app/drawing-tool/services/interfaces';
import { ProjectsService } from 'app/drawing-tool/services';
import { ActivatedRoute } from '@angular/router';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';

@Component({
  selector: 'app-map-preview',
  templateUrl: './map-preview.component.html',
})
export class MapPreviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', {static: true}) canvasChild;
  graphCanvas: CanvasGraphView;

  /**
   * Decide if network graph is visualized in full-screen or preview mode
   */
  screenMode = 'shrink';

  childMode = true;

  /**
   * Holds the current project.
   */
  currentProject: Project = null;

  constructor(
    private projectService: ProjectsService,
    private route: ActivatedRoute,
    private ngZone: NgZone,
  ) {
    if (this.route.snapshot.params.hash_id) {
      this.projectService.serveProject(
        this.route.snapshot.params.hash_id
      ).subscribe(
        resp => {
          this.childMode = false;
          // tslint:disable-next-line: no-string-literal
          this.project = resp['project'];
        },
        err => {
          console.log(err);
        }
      );
    }
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    const style = new KnowledgeMapStyle();
    this.graphCanvas = new CanvasGraphView(this.canvasChild.nativeElement as HTMLCanvasElement, {
      nodeRenderStyle: style,
      edgeRenderStyle: style,
    });
    this.graphCanvas.startParentFillResizeListener();

    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.startAnimationLoop();
    });

    // The @Input is set before we are ready, so we update the
    // graph here
    if (this.currentProject) {
      this.graphCanvas.setGraph(this.currentProject.graph);
      this.graphCanvas.zoomToFit(0);
    }
  }

  ngOnDestroy() {
    this.graphCanvas.destroy();
  }

  get project() {
    return this.currentProject;
  }

  @Input('project')
  set project(val: Project) {
    this.currentProject = val;

    if (this.graphCanvas) {
      this.graphCanvas.setGraph(this.currentProject.graph);
      this.graphCanvas.zoomToFit(0);
    }
  }

  /** Zoom to all the nodes on canvas  */
  fit() {
    this.graphCanvas.zoomToFit();
  }

  /** Switch between full-screen and preview mode of */
  toggle() {
    this.screenMode = this.screenMode === 'shrink' ? 'grow' : 'shrink';

    // Calculate the parameters for our animation
    const listWidth = this.screenMode === 'shrink' ? '25%' : '0%';
    const previewWidth = this.screenMode === 'shrink' ? '75%' : '100%';
    const listDuration = this.screenMode === 'shrink' ? 500 : 400;
    const previewDuration = 0;
    const containerHeight = this.screenMode === 'shrink' ? '70vh' : '100vh';
    const panelHeight = this.screenMode === 'shrink' ? '30vh' : '0vh';

    $('#map-list-container').animate({width: listWidth}, listDuration);
    $('#map-preview').animate({width: previewWidth}, previewDuration);

    $('#canvas-container').animate({height: containerHeight}, 600);
    $('#map-panel').animate({height: panelHeight}, 600);
  }
}
