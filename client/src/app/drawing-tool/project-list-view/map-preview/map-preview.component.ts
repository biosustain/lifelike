import { Component, OnInit, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { GraphSelectionData, UniversalGraph, VisNetworkGraphEdge, Project } from 'app/drawing-tool/services/interfaces';
import { NetworkVis } from 'app/drawing-tool/network-vis';
import { ProjectsService } from 'app/drawing-tool/services';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { Store, select } from '@ngrx/store';
import { State } from 'app/root-store';
import { AuthSelectors } from 'app/auth/store';
import { AuthenticationService } from 'app/auth/services/authentication.service';

@Component({
  selector: 'app-map-preview',
  templateUrl: './map-preview.component.html',
  styleUrls: [
    './map-preview.component.scss'
  ]
})
export class MapPreviewComponent implements OnInit {
  @Output() parentAPI: EventEmitter <any> = new EventEmitter <any> ();

  minimized = false;

  /**
   * ID of the user
   */
  userId;
  get isItMine() {
    if (!this.project) {
      return false;
    }
    return this.userId === this.project.user_id;
  }

  /** vis ojbect to control network-graph vis */
  visGraph: NetworkVis = null;

  /** The edge or node focused on */
  focusedEntity: GraphSelectionData = null;

  childMode = true;
  @HostBinding('class.relative') childPosition = false;

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
    this.visGraph = new NetworkVis(container, false);
    this.focusedEntity = null;

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
        this.visGraph.network.on(
          'doubleClick',
          (properties) => this.projectAPICall('edit')
        );
      },
      100
    );
  }

  get node() {
    if (!this.focusedEntity) { return null; }

    return this.focusedEntity.nodeData;
  }

  get nodeStyle() {
    return this.focusedEntity.nodeData.group || '';
  }

  userRoles$: Observable<string[]>;

  constructor(
    private projectService: ProjectsService,
    private route: ActivatedRoute,
    private store: Store<State>,
    private authService: AuthenticationService
  ) {
    this.userId = this.authService.whoAmI();

    if (this.route.snapshot.params.hash_id) {
      this.projectService.serveProject(
        this.route.snapshot.params.hash_id
      ).subscribe(
        resp => {
          this.childMode = false;
          this.childPosition = true;
          // tslint:disable-next-line: no-string-literal
          this.project = resp['project'];
        },
        err => {
          console.log(err);
        }
      );
    }

    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));
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

  /**
   * Call API functions in project-list view
   * component
   * @param param - something
   */
  projectAPICall(param) {
    this.parentAPI.emit({
      action: param,
      project: null
    });
  }

  /**
   * Hide or show meta-panel content
   */
  toggleHidden() {
    this.minimized = !this.minimized;
  }
}
