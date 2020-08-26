import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BehaviorSubject, EMPTY as empty, merge, of, Subject, Subscription } from 'rxjs';
import { filter, map, switchMap, take, tap } from 'rxjs/operators';

import { DataSet } from 'vis-network';

import { isArray, isNullOrUndefined } from 'util';

import {
  ExpandNodeRequest,
  ExpandNodeResult,
  GetClusterSnippetsResult,
  GetEdgeSnippetsResult,
  GraphNode,
  GraphRelationship,
  Neo4jGraphConfig,
  Neo4jResults,
  NewClusterSnippetsPageRequest,
  NewEdgeSnippetsPageRequest,
  VisEdge,
  VisNode,
} from 'app/interfaces';
import { LegendService } from 'app/shared/services/legend.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { VisualizationService } from '../../services/visualization.service';
import { createSearchParamsFromQuery, getQueryParams } from '../../../search/utils/search';
import { ProgressDialog } from '../../../shared/services/progress-dialog.service';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { MessageType } from '../../../interfaces/message-dialog.interface';
import { Progress } from '../../../interfaces/common-dialog.interface';
import { GraphSearchParameters } from '../../../search/graph-search';

@Component({
  selector: 'app-visualization',
  templateUrl: './visualization.component.html',
})
export class VisualizationComponent implements OnInit, OnDestroy {

  params: GraphSearchParameters;

  // Shows/Hide the component
  hideDisplay = false;

  networkGraphData: Neo4jResults;
  networkGraphConfig: Neo4jGraphConfig;
  nodes: DataSet<VisNode | GraphNode>;
  edges: DataSet<VisEdge | GraphRelationship>;

  expandNodeResult: ExpandNodeResult;
  getEdgeSnippetsResult: GetEdgeSnippetsResult;
  getClusterSnippetsResult: GetClusterSnippetsResult;
  getSnippetsError: HttpErrorResponse;

  getEdgeSnippetsSubject: Subject<NewEdgeSnippetsPageRequest>;
  getClusterSnippetsSubject: Subject<NewClusterSnippetsPageRequest>;
  getSnippetsSubscription: Subscription;

  nodeSelectedSubject: Subject<boolean>;

  // TODO: Will we need to have a legend for each database? i.e. the literature
  // data, biocyc, etc...
  legend: Map<string, string[]>;

  loadingClustersDialogRef;

  // TODO: Will we need to add more of these?
  LITERATURE_LABELS = ['disease', 'chemical', 'gene'];

  constructor(
    private route: ActivatedRoute,
    private visService: VisualizationService,
    private legendService: LegendService,
    private workspaceManager: WorkspaceManager,
    private readonly progressDialog: ProgressDialog,
    private readonly messageDialog: MessageDialog,
  ) {
    this.legend = new Map<string, string[]>();

    this.getClusterSnippetsSubject = new Subject<NewClusterSnippetsPageRequest>();
    this.getEdgeSnippetsSubject = new Subject<NewEdgeSnippetsPageRequest>();
    this.nodeSelectedSubject = new Subject<boolean>();

    // We don't want to kill the subscription if an error is returned! This is the default behavior for
    // subscriptions.
    this.getSnippetsSubscription = merge(
      // Merge the streams, so we can cancel one if the other emits; We always take the most recent
      // emission between the streams.
      this.getClusterSnippetsSubject,
      this.getEdgeSnippetsSubject,
      this.nodeSelectedSubject,
    ).pipe(
      switchMap((request: NewClusterSnippetsPageRequest | NewEdgeSnippetsPageRequest | boolean) => {
        if (typeof request === 'boolean') {
          // We don't currently need to do anything if the request was for node data
          return of(request);
        } else if (isArray(request.queryData)) {
          // If queryData is an array then we are getting snippets for a cluster
          return this.visService.getSnippetsForCluster(request as NewClusterSnippetsPageRequest);
        } else {
          return this.visService.getSnippetsForEdge(request as NewEdgeSnippetsPageRequest);
        }
      }),
    ).subscribe(
      // resp might be any of GetClusterSnippetsResult | GetEdgeSnippetsResult | boolean | HttpErrorResponse
      (resp: any) => {
        if (typeof resp === 'boolean') {
          // We don't currently need to do anything if the request was for node data
          return;
        } else if (!isNullOrUndefined(resp.error)) {
          // Response was an error
          this.getSnippetsError = resp;
          this.getClusterSnippetsResult = null;
          this.getEdgeSnippetsResult = null;
        } else if (isArray(resp.snippetData)) {
          // If snippetData is an array then we are getting snippets for a cluster
          this.getClusterSnippetsResult = resp as GetClusterSnippetsResult;
        } else {
          this.getEdgeSnippetsResult = resp as GetEdgeSnippetsResult;
        }
      },
    );
  }

  ngOnInit() {
    this.legendService.getAnnotationLegend().subscribe(legend => {
      Object.keys(legend).forEach(label => {
        if (this.LITERATURE_LABELS.includes(label)) {
          // Keys of the result dict are all lowercase, need to change the first character
          // to uppercase to match Neo4j labels
          const formattedLabel = label.slice(0, 1).toUpperCase() + label.slice(1);
          this.legend.set(formattedLabel, [legend[label].color, '#3797DB']);
        }
      });
    });

    this.route.queryParams.pipe(
      tap(params => {
        if (params.q != null) {
          this.params = createSearchParamsFromQuery(params);
        }
      }),
      filter(params => params.data),
      switchMap((params) => {
        if (!params.data) {
          return empty;
        }
        return this.visService.getBatch(params.data).pipe(
          map((result: Neo4jResults) => result),
        );
      }),
      take(1),
    ).subscribe((result) => {
      if (result) {
        this.networkGraphData = this.setupInitialProperties(result);
        this.nodes = new DataSet(this.networkGraphData.nodes);
        this.edges = new DataSet(this.networkGraphData.edges);
      }
    });

    this.getClusterSnippetsResult = null;
    this.getEdgeSnippetsResult = null;

    this.networkGraphConfig = {
      interaction: {
        hover: true,
        navigationButtons: true,
        multiselect: true,
        selectConnectedEdges: false,
      },
      physics: {
        enabled: true,
        barnesHut: {
          avoidOverlap: 0.2,
          centralGravity: 0.1,
          damping: 0.9,
          gravitationalConstant: -10000,
          springLength: 250,
        },
      },
      edges: {
        font: {
          size: 12,
        },
        widthConstraint: {
          maximum: 90,
        },
      },
      nodes: {
        size: 25,
        shape: 'box',
        // TODO: Investigate the 'scaling' property for dynamic resizing of 'box' shape nodes
      },
    };
  }

  ngOnDestroy() {
    this.getClusterSnippetsSubject.complete();
    this.getEdgeSnippetsSubject.complete();
    this.getSnippetsSubscription.unsubscribe();
  }

  /**
   * Redirects to the visualizer search page with the new query term as a URL parameter.
   * @param query string to search for
   */
  search(query: string) {
    this.workspaceManager.navigateByUrl(`/search?q=${query}`);
  }

  openNoResultsFromExpandDialog() {
    this.messageDialog.display({
      title: 'No Relationships',
      message: 'Expanded node had no connected relationships.',
      type: MessageType.Info,
    });
  }

  openLoadingClustersDialog() {
    this.loadingClustersDialogRef = this.progressDialog.display({
      title: `Node Expansion`,
      progressObservable: new BehaviorSubject<Progress>(new Progress({
        status: 'Loading clusters...',
      })),
    });

  }

  finishedClustering(event: boolean) {
    this.loadingClustersDialogRef.close();
  }

  /**
   * Used for adding properties custom properties on initial setup.
   * Is different from convertToVisJSFormat which is a reusable utility
   * function to rearrange custom properties.
   * @param result - neo4j results from AP call
   */
  setupInitialProperties(result: Neo4jResults): Neo4jResults {
    // Sets the node expand state to initially be false
    // Used for collapse/expand
    const setExpandProperty = result.nodes.map((n) => {
      return {...n, expanded: false};
    });
    return this.convertToVisJSFormat({nodes: setExpandProperty, edges: result.edges});
  }

  /**
   * This function is used to modify the API response to a format
   * vis.js will understand. vis.js uses a limited set
   * of properties for rendering the network graph.
   * @param result - a list of nodes and edges for conversion
   */
  convertToVisJSFormat(results: Neo4jResults): Neo4jResults {
    let {nodes, edges} = results;
    nodes = nodes.map((n: GraphNode) => this.convertNodeToVisJSFormat(n));
    edges = edges.map((e: GraphRelationship) => this.convertEdgeToVisJSFormat(e));
    return {nodes, edges};
  }

  convertNodeToVisJSFormat(n: GraphNode) {
    return {
      ...n,
      expanded: false,
      primaryLabel: n.label,
      font: {
        color: this.legend.get(n.label)[0],
      },
      color: {
        background: '#FFFFFF',
        border: this.legend.get(n.label)[1],
        hover: {
          background: '#FFFFFF',
          border: this.legend.get(n.label)[1],
        },
        highlight: {
          background: '#FFFFFF',
          border: this.legend.get(n.label)[1],
        },
      },
      label: n.displayName.length > 64 ? n.displayName.slice(0, 64) + '...' : n.displayName,
    };
  }

  convertEdgeToVisJSFormat(e: GraphRelationship) {
    return {
      ...e,
      color: {
        color: '#3797DB',
      },
      label: e.data.description,
      arrows: 'to',
    };
  }

  expandNode(expandNodeRequest: ExpandNodeRequest) {
    const {nodeId, filterLabels} = expandNodeRequest;

    if (filterLabels.length === 0) {
      this.openNoResultsFromExpandDialog();
      return;
    }

    this.openLoadingClustersDialog();

    this.visService.expandNode(nodeId, filterLabels).subscribe(
      (r: Neo4jResults) => {
        const nodeRef = this.nodes.get(nodeId) as VisNode;
        const visJSDataFormat = this.convertToVisJSFormat(r);
        let {nodes} = visJSDataFormat;
        const {edges} = visJSDataFormat;

        // If the expanded node has no connecting relationships, notify the user
        if (edges.length === 0) {
          this.openNoResultsFromExpandDialog();
          this.loadingClustersDialogRef.close();
          return;
        }

        // Sets the node expand state to true
        nodes = nodes.map((n) => {
          if (n.id === nodeId) {
            return {...n, expanded: !nodeRef.expanded};
          }
          return n;
        });

        this.nodes.update(nodes);
        this.edges.update(edges);

        this.expandNodeResult = {nodes, edges, expandedNode: nodeId} as ExpandNodeResult;
      },
      (error) => {
        this.loadingClustersDialogRef.close();
      },
    );
  }

  getSnippetsForEdge(request: NewEdgeSnippetsPageRequest) {
    this.getEdgeSnippetsSubject.next(request);
  }

  getSnippetsForCluster(request: NewClusterSnippetsPageRequest) {
    this.getClusterSnippetsSubject.next(request);
  }

  nodeSelectedCallback() {
    this.nodeSelectedSubject.next(true);
  }

  updateCanvasWithSingleNode(data: GraphNode) {
    this.nodes.clear();
    this.edges.clear();
    const node = this.convertNodeToVisJSFormat(data);
    this.nodes.add(node);
  }

  hideCanvas(state: boolean) {
    this.hideDisplay = state;
  }

  hasResultsButton() {
    return this.params;
  }

  goToResults() {
    this.workspaceManager.navigate(['/search'], {
      queryParams: getQueryParams(this.params),
    });
  }
}
