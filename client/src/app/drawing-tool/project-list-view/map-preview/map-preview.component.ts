import { Component, OnInit, Input } from '@angular/core';
import { GraphSelectionData, UniversalGraph, VisNetworkGraphEdge, Project } from 'app/drawing-tool/services/interfaces';
import { NetworkVis } from 'app/drawing-tool/network-vis';
import { ProjectsService } from 'app/drawing-tool/services';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-map-preview',
  templateUrl: './map-preview.component.html',
  styleUrls: ['./map-preview.component.scss']
})
export class MapPreviewComponent implements OnInit {
  /** vis ojbect to control network-graph vis */
  visGraph: NetworkVis = null;

  /** The edge or node focused on */
  focusedEntity: GraphSelectionData = null;

  /**
   * Decide if network graph is visualized
   * in full-screen or preview mode
   */
  screenMode = 'shrink';

  childMode = true;

  // tslint:disable-next-line: variable-name
  _project: Project = null;
  get project() {
    return this._project;
  }

  @Input('project')
  set project(val: Project) {
    this._project = val;

    const g = this.projectService.universe2Vis(val.graph);

    const container = document.getElementById('canvas');
    this.visGraph = new NetworkVis(container);

    setTimeout(
      () => {
        this.visGraph.draw(
          g.nodes,
          g.edges
        );

        this.visGraph.network.on(
          'click',
          (properties) => this.networkClickHandler(properties)
        );
      },
      100
    );
  }

  get node() {
    if (!this.focusedEntity) { return null; }

    return this.focusedEntity.nodeData;
  }

  constructor(
    private projectService: ProjectsService,
    private route: ActivatedRoute
  ) {
    if (this.project === null) {
      this.projectService.serveProject(
        this.route.snapshot.params.hash_id
      ).subscribe(
        resp => {
          this.childMode = false;
          this.project = resp['project'];
        },
        err => {
          console.log(err);
        }
      )
    }
  }

  ngOnInit() {

  }

  /**
   * Allow user to navigate to a link in a new tab
   * @param hyperlink - the linkto navigate to
   */
  goToLink(hyperlink: string) {
    if (
      hyperlink.includes('http')
    ) {
      window.open(hyperlink, '_blank');
    } else {
      window.open('http://' + hyperlink);
    }
  }

  /**
   * Listen for click events from vis.js network
   * to handle certain events ..
   * - if a node is clicked on
   * - if a edge is clicked on
   * - if a node is clicked on during addMode
   * @param properties - edge or node entity clicked on
   */
  networkClickHandler(properties) {
    if (properties.nodes.length) {
      // If a node is clicked on
      const nodeId = properties.nodes[0];
      this.focusedEntity = this.visGraph.getNode(nodeId);
    } else if (properties.edges.length) {
      // If an edge is clicked on
      // do nothing ..
    } else {
      this.focusedEntity = null;
    }
  }

  /**
   * Return other node connected to source in edge on a given edge
   * @param edge - represent edge from vis.js network
   */
  getNode(edge: VisNetworkGraphEdge) {
    return this.focusedEntity.otherNodes.filter(
      node => node.id === edge.to
    )[0].label;
  }

  /** Zoom to all the nodes on canvas  */
  fit() {
    this.visGraph.zoom2All();
  }

  /** Switch between full-screen and preview mode of */
  toggle() {
    this.screenMode = this.screenMode === 'shrink' ? 'grow' : 'shrink';

    // Calculate the parameters for our animation
    const listWidth = this.screenMode === 'shrink' ? '25%' : '0%';
    const previewWidth = this.screenMode === 'shrink' ? '75%' : '100%';
    const listDuration = this.screenMode === 'shrink' ? 500 : 400;
    const previewDuration = this.screenMode === 'shrink' ? 400 : 500;
    const containerHeight = this.screenMode === 'shrink' ? '70vh' : '100vh';
    const panelHeight = this.screenMode === 'shrink' ? '30vh' : '0vh';

    $('#map-list-container').animate({width: listWidth}, listDuration);
    $('#map-preview').animate({width: previewWidth}, previewDuration);

    $('#canvas-container').animate({height: containerHeight}, 600);
    $('#map-panel').animate({height: panelHeight}, 600);
  }
}
