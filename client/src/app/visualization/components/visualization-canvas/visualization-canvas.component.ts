import { Component, Input, EventEmitter, OnInit, Output, AfterViewInit } from '@angular/core';

import { isNil } from 'lodash-es';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Options } from '@popperjs/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { DataSet } from 'vis-data';
import { Network, IdType } from 'vis-network';

import {
  DuplicateVisEdge,
  DuplicateVisNode,
  Neo4jGraphConfig,
  VisEdge,
  VisNode,
} from 'app/interfaces/neo4j.interface';
import {
  AssociatedType,
  BulkReferenceTableDataRequest,
  ClusterData,
  DuplicateNodeEdgePair,
  Direction,
  DuplicateEdgeConnectionData,
  EdgeConnectionData,
  GetBulkReferenceTableDataResult,
  GetClusterSnippetsResult,
  GetEdgeSnippetsResult,
  GetReferenceTableDataResult,
  GroupRequest,
  NewClusterSnippetsPageRequest,
  NewEdgeSnippetsPageRequest,
  NodeDisplayInfo,
  ReferenceTableDataRequest,
  ReferenceTablePair,
  ReferenceTableRow,
  SettingsFormValues,
  SidenavEntityType,
  SidenavClusterEntity,
  SidenavEdgeEntity,
  SidenavNodeEntity,
  SidenavSnippetData,
  SidenavTypeEntity,
} from 'app/interfaces/visualization.interface';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { ProgressDialogComponent } from 'app/shared/components/dialog/progress-dialog.component';
import { SNIPPET_PAGE_LIMIT } from 'app/shared/constants';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { uuidv4 } from 'app/shared/utils';
import { ContextMenuControlService } from 'app/visualization/services/context-menu-control.service';
import { VisualizationService } from 'app/visualization/services/visualization.service';

@Component({
  selector: 'app-visualization-canvas',
  templateUrl: './visualization-canvas.component.html',
  styleUrls: ['./visualization-canvas.component.scss'],
  providers: [ContextMenuControlService],
})
export class VisualizationCanvasComponent<NodeData = object, EdgeData = object>
  implements OnInit, AfterViewInit
{
  @Output() finishedClustering = new EventEmitter<boolean>();
  @Output() getSnippetsForEdge = new EventEmitter<NewEdgeSnippetsPageRequest>();
  @Output() getSnippetsForCluster = new EventEmitter<NewClusterSnippetsPageRequest>();
  @Output() getNodeData = new EventEmitter<boolean>();

  @Input() nodes: DataSet<VisNode | DuplicateVisNode, 'id'>;
  @Input() edges: DataSet<VisEdge | DuplicateVisEdge, 'id'>;
  @Input() set getEdgeSnippetsResult(result: GetEdgeSnippetsResult) {
    if (!isNil(result)) {
      try {
        const toNode = this.nodes.get(result.snippetData.toNodeId);
        const fromNode = this.nodes.get(result.snippetData.fromNodeId);

        if (isNil(toNode) || isNil(fromNode)) {
          throw Error('One or more returned nodes do not exist on the network!');
        }

        this.sidenavEntity = {
          snippetData: {
            to: {
              primaryLabel: toNode.primaryLabel,
              displayName: toNode.displayName,
              url: toNode.entityUrl,
            } as NodeDisplayInfo,
            from: {
              primaryLabel: fromNode.primaryLabel,
              displayName: fromNode.displayName,
              url: fromNode.entityUrl,
            } as NodeDisplayInfo,
            association: result.snippetData.association,
            snippets: result.snippetData.snippets,
          } as SidenavSnippetData,
          queryData: result.queryData,
          totalResults: result.totalResults,
        } as SidenavEdgeEntity;
      } catch (error) {
        this.getSnippetsError = error;
        this.sidenavEntity = null;
      }
    }
  }
  @Input() set getClusterSnippetsResult(result: GetClusterSnippetsResult) {
    if (!isNil(result)) {
      try {
        const data = result.snippetData.map((snippetResult) => {
          const toNode = this.nodes.get(snippetResult.toNodeId);
          const fromNode = this.nodes.get(snippetResult.fromNodeId);

          if (isNil(toNode) || isNil(fromNode)) {
            throw Error('One or more returned nodes do not exist on the network!');
          }

          return {
            to: {
              primaryLabel: toNode.primaryLabel,
              displayName: toNode.displayName,
              url: toNode.entityUrl,
            } as NodeDisplayInfo,
            from: {
              primaryLabel: fromNode.primaryLabel,
              displayName: fromNode.displayName,
              url: fromNode.entityUrl,
            } as NodeDisplayInfo,
            association: snippetResult.association,
            snippets: snippetResult.snippets,
          } as SidenavSnippetData;
        });
        this.sidenavEntity = {
          queryData: result.queryData,
          totalResults: result.totalResults,
          snippetData: data,
        } as SidenavClusterEntity;
      } catch (error) {
        this.getSnippetsError = error;
        this.sidenavEntity = null;
      }
    }
  }
  @Input() getSnippetsError: Error;

  // Configuration for the graph view. See vis.js docs
  @Input() config: Neo4jGraphConfig;
  @Input() legend: Map<string, string[]>;

  legendLabels: string[];

  // Need to create a reference to the enum so we can use it in the template
  sidenavEntityTypeEnum = SidenavEntityType;

  sidenavOpened: boolean;
  sidenavEntity: SidenavNodeEntity | SidenavEdgeEntity | SidenavClusterEntity | SidenavTypeEntity;
  sidenavEntityType: SidenavEntityType;
  isNewClusterSidenavEntity: boolean;
  isNewEdgeSidenavEntity: boolean;

  networkGraph: Network;
  networkContainerId: string;
  selectedNodes: IdType[];
  selectedNodeEdgeLabelData: Map<string, Direction[]>;
  selectedEdges: IdType[];
  referenceTableData: DuplicateNodeEdgePair[];
  clusters: Map<IdType, ClusterData>;
  openClusteringRequests: number;
  selectedClusterNodeData: VisNode[];

  readonly clusterCreatedSource: Subject<boolean>;
  clusteringSubscription: Subscription;

  contextMenuTooltipOptions: Partial<Options>;

  settingsFormValues: SettingsFormValues;

  loadingClustersDialogRef: Omit<NgbModalRef, 'componentInstance'> & {
    componentInstance: ProgressDialogComponent;
  };

  constructor(
    private contextMenuControlService: ContextMenuControlService,
    private visService: VisualizationService,
    private readonly messageDialog: MessageDialog,
    private readonly progressDialog: ProgressDialog
  ) {
    this.networkContainerId = uuidv4();

    this.legendLabels = [];

    this.sidenavOpened = false;
    this.sidenavEntity = null;
    this.sidenavEntityType = SidenavEntityType.EMPTY;
    this.isNewClusterSidenavEntity = true;
    this.isNewEdgeSidenavEntity = true;

    this.selectedNodes = [];
    this.selectedEdges = [];
    this.selectedNodeEdgeLabelData = new Map<string, Direction[]>();
    this.referenceTableData = [];

    this.contextMenuTooltipOptions = {
      placement: 'right-start',
    };

    this.clusters = new Map<IdType, ClusterData>();
    this.openClusteringRequests = 0;
    this.clusterCreatedSource = new Subject<boolean>();
    this.selectedClusterNodeData = [];
  }

  ngOnInit() {
    this.legendLabels = Array.from(this.legend.keys());
  }

  // Need to initialize the network after the view is initialized, otherwise we get weird re-sizing issues
  // for Vis.js
  ngAfterViewInit() {
    const container = document.getElementById(this.networkContainerId);
    const data = {
      nodes: this.nodes,
      edges: this.edges,
    };
    this.networkGraph = new Network(container, data, this.config);
    this.visualizerSetupEventBinds();
  }

  updateSettings(event: SettingsFormValues) {
    // First time we get the settings form values we do a full copy (these are the default values)
    if (isNil(this.settingsFormValues)) {
      this.settingsFormValues = event;
    } else {
      // On subsequent emissions, we only update a property if it is valid
      Object.keys(event).forEach((key) => {
        if (event[key].valid) {
          const prevVal = this.settingsFormValues[key].value;
          this.settingsFormValues[key] = event[key];

          if (key === 'maxClusterShownRows') {
            // If the user updated the max row count, update all the cluster SVGs to show the new amount
            if (prevVal !== event[key].value) {
              this.clusters.forEach((_, clusterId) => {
                const newClusterSvg = this.createClusterSvg(
                  this.clusters.get(clusterId).referenceTableRows
                );
                this.networkGraph.updateClusteredNode(clusterId, { image: newClusterSvg });
              });
            }
          }
        }
      });

      // Set the new animation state, if any
      this.networkGraph.setOptions({ physics: this.settingsFormValues.animation.value });
    }
  }

  openSidenav() {
    this.sidenavOpened = true;
  }

  closeSidenav() {
    this.sidenavOpened = false;
  }

  updateSelectedNodes() {
    this.selectedNodes = this.networkGraph.getSelectedNodes();
  }

  updateSelectedEdges() {
    this.selectedEdges = this.networkGraph
      .getSelectedEdges()
      .filter((edgeId) => this.isNotAClusteredEdge(edgeId));
  }

  updateSelectedNodesAndEdges() {
    this.updateSelectedNodes();
    this.updateSelectedEdges();
  }

  clearSelectedNodeEdgeLabelData() {
    this.selectedNodeEdgeLabelData.clear();
  }

  updateSelectedNodeEdgeLabelData(selectedNode: IdType) {
    this.clearSelectedNodeEdgeLabelData();
    this.selectedNodeEdgeLabelData = this.getConnectedEdgeLabels(selectedNode);
  }

  collapseNeighbors(rootNode: VisNode) {
    // Get all the nodes connected to the root node, before removing edges
    const connectedNodes = this.networkGraph.getConnectedNodes(rootNode.id) as IdType[];

    // Remove every cluster connected to the root node
    connectedNodes.forEach((connectedNode) => {
      if (this.networkGraph.isCluster(connectedNode)) {
        this.destroyCluster(connectedNode);
      }
    });

    this.edges.remove(this.networkGraph.getConnectedEdges(rootNode.id) as IdType[]);

    // If a previously connected node has no remaining edges (i.e. it is not connected
    // to any other neighbor), remove it.
    const nodesToRemove = connectedNodes.map((connectedNodeId: IdType) => {
      if (this.networkGraph.findNode(connectedNodeId).length !== 0) {
        const connectedEdges = this.networkGraph.getConnectedEdges(connectedNodeId);
        if (connectedEdges.length === 0) {
          return connectedNodeId;
        }
      }
    });
    this.nodes.remove(nodesToRemove);
  }

  toggleNodeExpandState(nodeId: IdType) {
    const nodeRef = this.nodes.get(nodeId);

    if (nodeRef.expanded) {
      this.collapseNode(nodeRef);
    } else {
      // Need to request new data from the parent when nodes are expanded
      const filterLabels = Array.from(this.legend.keys()).filter(
        (key) => this.settingsFormValues[key].value
      );
      this.expandNode(nodeId, filterLabels);
    }
  }

  collapseNode(nodeRef: VisNode) {
    // Updates node expand state
    const updatedNodeState = { ...nodeRef, expanded: !nodeRef.expanded };
    this.nodes.update(updatedNodeState);
    // 'Collapse' all neighbor nodes that do not themselves have neighbors
    this.collapseNeighbors(nodeRef);
  }

  expandNode(nodeId: IdType, filterLabels: string[]) {
    if (filterLabels.length === 0) {
      this.openNoResultsFromExpandDialog();
      return;
    }

    this.openLoadingClustersDialog();

    this.visService.expandNode(nodeId, filterLabels).subscribe(
      (bulkResult: GetBulkReferenceTableDataResult) => {
        // If the expanded node has no connecting relationships, notify the user
        if (bulkResult.referenceTables.length === 0) {
          this.loadingClustersDialogRef.close();
          this.openNoResultsFromExpandDialog();
          return;
        }

        // Set the origin node's expand state to true
        let nodeRef = this.nodes.get(nodeId) as VisNode;
        nodeRef = { ...nodeRef, expanded: true };
        this.nodes.update(nodeRef);

        bulkResult.referenceTables
          // Sorting the tables by length makes creating clusters faster by doing the smallest tables first
          .sort((a, b) => a.referenceTableRows.length - b.referenceTableRows.length)
          .forEach((table: GetReferenceTableDataResult) => {
            const { referenceTableRows, direction, description } = table;
            const duplicateNodeEdgePairs = table.duplicateNodeEdgePairs.map((pair) => {
              return {
                node: this.visService.convertNodeToVisJSFormat(pair.node, this.legend),
                edge: this.visService.convertEdgeToVisJSFormat(pair.edge),
              } as DuplicateNodeEdgePair;
            });
            this.processGetReferenceTableResults(
              nodeId,
              duplicateNodeEdgePairs,
              referenceTableRows,
              description,
              direction
            );
          });
        // Done loading clusters so close the dialog automatically
        this.loadingClustersDialogRef.close();
      },
      (error) => {
        this.loadingClustersDialogRef.close();
        this.openErrorDialog('Node Expansion Error', error);
      }
    );
  }

  fitToScreen(event: EventEmitter<any>) {
    this.networkGraph.fit();
  }

  /**
   * Gets the shared edges between the two input nodes.
   */
  getEdgesBetweenNodes(src: IdType, dest: IdType) {
    return this.networkGraph
      .getConnectedEdges(src)
      .filter((edge) => this.networkGraph.getConnectedEdges(dest).includes(edge));
  }

  /**
   * Check that the input is a normal edge and that it isn't currently clustered.
   * @param edge the id of the edge to check
   */
  isNotAClusteredEdge(edge: IdType) {
    const baseEdges = this.networkGraph.getBaseEdges(edge);
    // If 'edge' is a base edge, the value of `getBaseEdges` should be a list with a single value: the edge id itself. If it were a
    // cluster, it could still be a list with a single value, but that value would NOT be the cluster edge id, it would be whatever
    // base edge was clustered.
    const notAClusterEdge = baseEdges.length === 1 && baseEdges.includes(edge);
    // Furthermore, we can quickly check that 'edge' is not in a cluster by checking the length of `getClusteredEdges`: if it is more
    // than 1, the edge is in at least one cluster.
    const notInAClusterEdge = this.networkGraph.getClusteredEdges(edge).length === 1;
    return notAClusterEdge && notInAClusterEdge;
  }

  /**
   * Gets all the neighbors of the given node, connected by the given relationship, in the given direction.
   *
   * If `direction` is Direction.TO, we only want to get the neighbors where the edge is coming to `node`.
   * The opposite is true if `direction` is Direction.FROM.
   * @param relationship string representing the connecting relationship
   * @param node id of the root node
   * @param direction represents the direction of the connecting relationship
   */
  getNeighborsWithRelationship(relationship: string, node: IdType, direction: Direction) {
    return this.networkGraph
      .getConnectedEdges(node)
      .filter((edgeId) => {
        const edge = this.edges.get(edgeId);
        // First check if this is the correct relationship
        if (this.isNotAClusteredEdge(edgeId) && edge.label === relationship) {
          // Then, check that it is in the correct direction
          if (direction === Direction.FROM && edge.from === node) {
            return true;
          } else if (direction === Direction.TO && edge.to === node) {
            return true;
          }
        }
      })
      .map(
        (connectedEdgeWithRel) =>
          (this.networkGraph.getConnectedNodes(connectedEdgeWithRel) as IdType[]).filter(
            (nodeId) => nodeId !== node
          )[0]
      );
  }

  /**
   * Gets a set of labels from the edges connected to the input node.
   * @param selectedNode the ID of the node whose edge labels we want to get
   */
  getConnectedEdgeLabels(selectedNode: IdType): Map<string, Direction[]> {
    const labels = new Map<string, Direction[]>();
    const clustersConnectedToSelectedNode = (
      this.networkGraph.getConnectedNodes(selectedNode) as IdType[]
    ).filter((nodeId) => this.networkGraph.isCluster(nodeId));

    this.networkGraph
      .getConnectedEdges(selectedNode)
      .filter((edge) => this.isNotAClusteredEdge(edge))
      .forEach((edgeId) => {
        const edge = this.edges.get(edgeId);
        const { label, from, to } = edge;

        // TODO: Need to validate that this is the expected behavior
        const connectedClustersOnRel = clustersConnectedToSelectedNode.filter(
          (clusterId: string) => this.clusters.get(clusterId).relationship === label
        );
        if (connectedClustersOnRel.length > 0) {
          const nonHubNode = selectedNode === to ? from : to;
          // Check if the non-hub node is present in any of the existing clusters connected
          // to the hub node
          const nonHubNodeIsInConnectedCluster = connectedClustersOnRel
            .map((clusterId) => {
              return this.networkGraph
                .getNodesInCluster(clusterId)
                .map((duplicateNodeId) => {
                  return (this.nodes.get(duplicateNodeId) as DuplicateVisNode).duplicateOf;
                })
                .includes(nonHubNode);
            })
            .some((nonHubNodeInACluster) => nonHubNodeInACluster);

          if (nonHubNodeIsInConnectedCluster) {
            return;
          }
        }

        if (!isNil(labels.get(label))) {
          // Either `TO` or `FROM` is already in the direction list for this label, so check to see which one we need to add
          const shouldAddTo = selectedNode === to && !labels.get(label).includes(Direction.TO);
          const shouldAddFrom =
            selectedNode === from && !labels.get(label).includes(Direction.FROM);
          if (shouldAddTo || shouldAddFrom) {
            labels.set(label, [Direction.TO, Direction.FROM]);
          }
        } else {
          labels.set(label, [selectedNode === to ? Direction.TO : Direction.FROM]);
        }
      });
    return labels;
  }

  createClusterSvg(referenceTableRows: ReferenceTableRow[]) {
    let svgHeight;
    let svgWidth;
    let rowsHTMLString;
    const FLUFF_HEIGHT = 15 + 5 + 4; // height of rows + padding height + border height
    const FLUFF_WIDTH = 21 + 6; // padding + border
    const WIDTH_MULTIPLIER = 1.5; // multiplier to massage the width to about what we want
    const ctx = document.getElementsByTagName('canvas')[0].getContext('2d');

    if (referenceTableRows.length) {
      const maxSnippetCount = referenceTableRows[0]?.snippetCount || 0;
      const maxRowsToShow = this.settingsFormValues.maxClusterShownRows.value;
      const numRowsToShow =
        referenceTableRows.length > maxRowsToShow ? maxRowsToShow : referenceTableRows.length;

      const maxNodesCellText = `Showing ${numRowsToShow} of ${referenceTableRows.length} clustered nodes`;
      rowsHTMLString = referenceTableRows
        .slice(0, maxRowsToShow)
        .map((row, index) => {
          const percentOfMax =
            row.snippetCount === 0 ? row.snippetCount : (row.snippetCount / maxSnippetCount) * 100;
          let rowHTMLString = `
              <tr class='reference-table-row'>
                  <td class='entity-name-container' style='color: ${
                    this.legend.get(row.nodeLabel)[0]
                  }'>${row.nodeDisplayName}</td>
                  <td class='snippet-count-container'>(${row.snippetCount})</td>
                  <td class='snippet-bar-container'>
                      <div class='snippet-bar-repr' style='width: ${percentOfMax}px;'></div>
                  </td>
              </tr>`;
          if (index === numRowsToShow - 1) {
            rowHTMLString += `
                  <tr class='reference-table-row'>
                      <td class='max-nodes-cell' colspan='3'>${maxNodesCellText}</td>
                  </tr>
                  `;
          }
          return rowHTMLString;
        })
        .join('\n');
      const longestName = referenceTableRows
        .slice(0, maxRowsToShow)
        .sort(
          (a, b) =>
            ctx.measureText(b.nodeDisplayName).width - ctx.measureText(a.nodeDisplayName).width
        )[0].nodeDisplayName;

      // Get width of SVG
      svgWidth = Math.max(
        // width of biggest name + max width of counts + max width of bars + constant width
        Math.floor(
          ctx.measureText(longestName).width * WIDTH_MULTIPLIER +
            ctx.measureText(`(${maxSnippetCount})`).width * WIDTH_MULTIPLIER +
            100 +
            FLUFF_WIDTH
        ),
        // OR width of the max-nodes-cell + constant width
        Math.floor(ctx.measureText(maxNodesCellText).width * WIDTH_MULTIPLIER + FLUFF_WIDTH)
      );

      // Get height of SVG
      // Add a single extra row to accomodate the max-nodes-cell
      const numRows = referenceTableRows.slice(0, maxRowsToShow).length + 1;
      // constant height * # of rows
      svgHeight = FLUFF_HEIGHT * numRows;
    } else {
      const cellText = 'Showing 0 of 0 clustered nodes';
      svgWidth = ctx.measureText(cellText).width * WIDTH_MULTIPLIER + FLUFF_WIDTH;
      svgHeight = FLUFF_HEIGHT;
      rowsHTMLString = `
            <tr class='reference-table-row'>
              <td class='max-nodes-cell' colspan='3'>${cellText}</td>
            </tr>
            `;
    }
    const svg = `<svg xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 ${svgWidth} ${svgHeight}' width='${svgWidth}' height='${svgHeight}' preserveAspectRatio='xMinYMin meet'>
            <style type='text/css'>
                table, td {
                    border-collapse: collapse;
                }

                td {
                    border: thin solid #0c8caa;
                    padding: 2.5px 3.5px;
                }

                .reference-table {
                    background: #FFFFFF;
                    border: thin solid #0c8caa;
                    border-radius: 2px;
                    color: #0c8caa;
                    font-family: Roboto, 'Helvetica Neue', sans-serif;
                    font-size: 12px;
                    font-weight: bold;
                    height: ${svgHeight}px;
                    width: ${svgWidth}px;
                }

                .reference-table-row {
                    height: 15px;
                }

                .entity-name-container {
                    text-align: right;
                }

                .max-nodes-cell {
                    text-align: center;
                }

                .snippet-count-container {
                    text-align: center
                }

                .snippet-bar-container {
                    width: 100px;
                }

                .snippet-bar-repr {
                    height: 10px;
                    background: #0c8caa;
                }
            </style>
            <foreignObject x='0' y='0' width='100%' height='100%'>
                <div xmlns='http://www.w3.org/1999/xhtml'>
                    <table class='reference-table'>${rowsHTMLString}</table>
                </div>
            </foreignObject>
        </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  createOriginalNodeFromDuplicate(duplicateNode: DuplicateVisNode) {
    return {
      id: duplicateNode.duplicateOf,
      label: duplicateNode.label,
      data: duplicateNode.data,
      subLabels: duplicateNode.subLabels,
      displayName: duplicateNode.displayName,
      primaryLabel: duplicateNode.primaryLabel,
      expanded: duplicateNode.expanded,
      color: duplicateNode.color,
      font: duplicateNode.font,
      entityUrl: duplicateNode.entityUrl,
    } as VisNode;
  }

  createDuplicateNodeFromOriginal(originalNode: VisNode) {
    const newDuplicateNodeId = 'duplicateNode:' + uuidv4();
    return {
      ...originalNode,
      id: newDuplicateNodeId,
      duplicateOf: originalNode.id,
    } as DuplicateVisNode;
  }

  createOriginalEdgeFromDuplicate(duplicateEdge: DuplicateVisEdge) {
    return {
      id: duplicateEdge.duplicateOf,
      label: duplicateEdge.label,
      data: duplicateEdge.data,
      to: duplicateEdge.originalTo,
      from: duplicateEdge.originalFrom,
      toLabel: duplicateEdge.toLabel,
      fromLabel: duplicateEdge.fromLabel,
      arrows: duplicateEdge.arrows,
      color: duplicateEdge.color,
    } as VisEdge;
  }

  createDuplicateEdgeFromOriginal(
    originalEdge: VisEdge,
    clusterOrigin: IdType,
    duplicateNode: DuplicateVisNode
  ) {
    const newDuplicateEdgeId = 'duplicateEdge:' + uuidv4();
    return {
      ...originalEdge,
      id: newDuplicateEdgeId,
      duplicateOf: originalEdge.id,
      from: originalEdge.from === clusterOrigin ? clusterOrigin : duplicateNode.id,
      to: originalEdge.to === clusterOrigin ? clusterOrigin : duplicateNode.id,
      originalFrom: originalEdge.from,
      originalTo: originalEdge.to,
    } as DuplicateVisEdge;
  }

  /**
   * Pulls out a node from a cluster given a duplicate node ID. We find the cluster containing the given
   * ID, and then re-create the original node from the duplicate. This DOES NOT remove the duplicate
   * from the cluster! It simply re-draws the original using the duplicate's info. Also redraws the
   * original edge.
   *
   * @param duplicateNodeId ID of the duplicate node we wish to find
   */
  removeNodeFromCluster(duplicateNodeId: IdType) {
    const duplicateNode = this.nodes.get(duplicateNodeId) as DuplicateVisNode;

    // If the original node is not currently drawn on the canvas, redraw it.
    if (isNil(this.nodes.get(duplicateNode.duplicateOf))) {
      this.nodes.update(this.createOriginalNodeFromDuplicate(duplicateNode));
    }

    // Redraw the original edge
    this.networkGraph
      .getConnectedEdges(duplicateNodeId)
      .map((duplicateEdgeId) => this.edges.get(duplicateEdgeId) as DuplicateVisEdge)
      .forEach((duplicateEdge) => {
        this.edges.update(this.createOriginalEdgeFromDuplicate(duplicateEdge));
      });
  }

  /**
   * Helper method for cleaning up the canvas after a cluster is opened. All cluster
   * nodes/edges are duplicates, so we have to remove them when a cluster is opened.
   * We also redraw the originals if they are not already present on the canvas.
   * @param nodesInCluster the list of duplicate node IDs in the opened cluster
   */
  cleanUpDuplicates(nodesInCluster: IdType[]) {
    const edgesToRemove = [];
    const nodesToRemove = [];
    const edgesToAdd = [];
    const nodesToAdd = [];

    nodesInCluster.forEach((duplicateNodeId) => {
      const duplicateNode = this.nodes.get(duplicateNodeId) as DuplicateVisNode;
      // If the original node is not currently drawn on the canvas, redraw it
      if (isNil(this.nodes.get(duplicateNode.duplicateOf))) {
        nodesToAdd.push(this.createOriginalNodeFromDuplicate(duplicateNode));
      }

      this.networkGraph
        .getConnectedEdges(duplicateNodeId)
        .map((duplicateEdgeId) => this.edges.get(duplicateEdgeId) as DuplicateVisEdge)
        .forEach((duplicateEdge) => {
          edgesToRemove.push(duplicateEdge.id);
          edgesToAdd.push(this.createOriginalEdgeFromDuplicate(duplicateEdge));
        });

      nodesToRemove.push(duplicateNodeId);
    });

    this.nodes.remove(nodesToRemove);
    this.edges.remove(edgesToRemove);

    this.nodes.update(nodesToAdd);
    this.edges.update(edgesToAdd);
  }

  /**
   * Helper method for creating duplicate nodes and edges given clustering information. All
   * nodes/edges within a cluster are duplicates of the original nodes. This is done so we
   * can view the original node if it would still have some remaining edges after clustering.
   * This method does NOT alter the network data, it only creates duplicate node/edge objects.
   * @param neighborNodesWithRel the list of original node IDs to be clustered
   * @param relationship the relationship which is being clustered
   * @param node the source node for the cluster
   */
  createDuplicateNodesAndEdges(
    neighborNodesWithRel: IdType[],
    relationship: string,
    clusterOrigin: IdType,
    direction: Direction
  ) {
    return neighborNodesWithRel.map((neighborNodeId) => {
      let edges = this.networkGraph.getConnectedEdges(neighborNodeId);
      const newDuplicateNode = this.createDuplicateNodeFromOriginal(this.nodes.get(neighborNodeId));

      edges = edges.filter((id) => {
        const edge = this.edges.get(id);
        // Make sure the edges we duplicate have the grouped relationship and that they are connected to the cluster origin
        if (this.isNotAClusteredEdge(id) && edge.label === relationship) {
          // Then, check that it is in the correct direction
          if (direction === Direction.FROM && edge.from === clusterOrigin) {
            return true;
          } else if (direction === Direction.TO && edge.to === clusterOrigin) {
            return true;
          }
        }
        return false;
      });

      if (edges.length !== 1) {
        throw Error(
          `Neighbor node should have exactly one edge between origin node ${clusterOrigin} ` +
            `with label ${relationship} and direction ${direction}. Found ${edges.length} instead`
        );
      }

      const newDuplicateEdge = this.createDuplicateEdgeFromOriginal(
        this.edges.get(edges[0]),
        clusterOrigin as IdType,
        newDuplicateNode
      );

      return {
        node: newDuplicateNode,
        edge: newDuplicateEdge,
      } as DuplicateNodeEdgePair;
    });
  }

  /**
   * Helper function for updating the graph with duplicate nodes and edges. Used by groupNeighborsWithRelationship
   * to prep for clustering.
   *
   * If a node would have no remaining edges after clustering, we remove it from the canvas
   * entirely. It and its corresponding edge will be redrawn when the cluster is opened.
   * @param duplicateNodeEdgePairs the list of duplicate node/edge pairs to update the network with
   */
  updateGraphWithDuplicates(duplicateNodeEdgePairs: DuplicateNodeEdgePair[]) {
    const duplicateNodesToAdd = [];
    const duplicateEdgesToAdd = [];
    const nodesToRemove = [];
    const edgesToRemove = [];

    duplicateNodeEdgePairs.forEach((pair) => {
      const duplicateNode = pair.node;
      const duplicateEdge = pair.edge;

      duplicateNodesToAdd.push(duplicateNode);
      duplicateEdgesToAdd.push(duplicateEdge);

      if (this.networkGraph.findNode(duplicateNode.duplicateOf).length !== 0) {
        const edges = this.networkGraph.getConnectedEdges(duplicateNode.duplicateOf);

        if (edges.length === 1) {
          // If the original node is being clustered on its last unclustered edge,
          // remove it entirely from the canvas.
          nodesToRemove.push(duplicateNode.duplicateOf);
          edgesToRemove.push(duplicateEdge.duplicateOf);
        } else if (this.networkGraph.getConnectedNodes(duplicateNode.duplicateOf).length === 1) {
          // Otherwise, don't remove the original node, and only remove the original edge if the
          // candidate node is not connected to any other node.
          edgesToRemove.push(duplicateEdge.duplicateOf);
        }
      }
    });

    this.edges.remove(edgesToRemove);
    this.nodes.remove(nodesToRemove);

    this.nodes.update(duplicateNodesToAdd);
    this.edges.update(duplicateEdgesToAdd);
  }

  safelyOpenCluster(clusterNodeId) {
    const nodesInCluster = this.networkGraph.getNodesInCluster(clusterNodeId);

    // Clean up the cluster
    this.networkGraph.openCluster(clusterNodeId);
    this.clusters.delete(clusterNodeId as IdType);

    this.cleanUpDuplicates(nodesInCluster);
  }

  destroyCluster(clusterNodeId: IdType) {
    const nodesInCluster = this.networkGraph.getNodesInCluster(clusterNodeId);
    const edgesInCluster = [];

    nodesInCluster.forEach((nodeId) => {
      this.networkGraph.getConnectedEdges(nodeId).forEach((edgeId) => edgesInCluster.push(edgeId));
    });

    // Destroy the cluster
    this.networkGraph.openCluster(clusterNodeId);
    this.clusters.delete(clusterNodeId as IdType);

    this.nodes.remove(nodesInCluster);
    this.edges.remove(edgesInCluster);
  }

  resetClustersOnRelationshipAndDirection(
    originNode: IdType,
    relationship: string,
    direction: string
  ) {
    // Remove any existing clusters connected to the origin node on this relationship/direction first. Any
    // nodes within should have been included in the duplicateNodeEdgePairs array sent to the appserver.
    this.networkGraph.getConnectedNodes(originNode).forEach((nodeId) => {
      if (this.networkGraph.isCluster(nodeId)) {
        const cluster = this.clusters.get(nodeId);
        if (cluster.relationship === relationship && cluster.direction === direction) {
          this.destroyCluster(nodeId);
        }
      }
    });
  }

  addClusterToGraph(
    svgUrl: string,
    duplicateNodeEdgePairs: DuplicateNodeEdgePair[],
    referenceTableRows: ReferenceTableRow[],
    relationship: string,
    direction: Direction
  ) {
    this.networkGraph.cluster({
      joinCondition: (n) => duplicateNodeEdgePairs.map((pair) => pair.node.id).includes(n.id),
      clusterNodeProperties: {
        image: svgUrl,
        label: null,
        shape: 'image',
        shapeProperties: {
          useImageSize: true,
        },
        size: this.config.nodes.size,
        // This setting is valid as described under 'clusterNodeProperties'
        // here: https://visjs.github.io/vis-network/docs/network/index.html#optionsObject
        // @ts-ignore
        allowSingleNodeCluster: true,
      },
      clusterEdgeProperties: {
        label: relationship,
      },
      processProperties: (clusterOptions) => {
        const newClusterId = `cluster:${uuidv4()}`;
        this.clusters.set(newClusterId, { referenceTableRows, relationship, direction });
        return { ...clusterOptions, id: newClusterId };
      },
    });
  }

  processGetReferenceTableResults(
    originNode: IdType,
    duplicateNodeEdgePairs: DuplicateNodeEdgePair[],
    referenceTableRows: ReferenceTableRow[],
    relationship: string,
    direction: Direction
  ) {
    const url = this.createClusterSvg(referenceTableRows);

    this.resetClustersOnRelationshipAndDirection(originNode, relationship, direction);
    this.updateGraphWithDuplicates(duplicateNodeEdgePairs);
    // TODO: Would be nice to have some indication that the cluster has been selected.
    // A bit tricky, since clusters are SVGs, but maybe this can be done.
    this.addClusterToGraph(
      url,
      duplicateNodeEdgePairs,
      referenceTableRows,
      relationship,
      direction
    );
    this.updateSelectedNodeEdgeLabelData(originNode);
  }

  getReferenceTableDataRequestObject(duplicateNodeEdgePairs: DuplicateNodeEdgePair[]) {
    return {
      nodeEdgePairs: duplicateNodeEdgePairs.map((pair) => {
        return {
          node: {
            id: pair.node.id,
            displayName: pair.node.displayName,
            label: pair.node.primaryLabel,
          },
          edge: {
            originalFrom: pair.edge.originalFrom,
            originalTo: pair.edge.originalTo,
            label: pair.edge.label,
          },
        } as ReferenceTablePair;
      }),
    } as ReferenceTableDataRequest;
  }

  createCluster(
    originNode: IdType,
    relationship: string,
    duplicateNodeEdgePairs: DuplicateNodeEdgePair[]
  ) {
    this.openClusteringRequests += 1;

    const referenceTableDataRequest =
      this.getReferenceTableDataRequestObject(duplicateNodeEdgePairs);

    this.visService.getReferenceTableData(referenceTableDataRequest).subscribe((result) => {
      const { referenceTableRows, direction } = result;
      this.processGetReferenceTableResults(
        originNode,
        duplicateNodeEdgePairs,
        referenceTableRows,
        relationship,
        direction
      );
      this.openClusteringRequests -= 1;
      this.clusterCreatedSource.next(true);
    });
  }

  getBulkReferenceTableDataRequestObj(associations: Map<string, DuplicateNodeEdgePair[]>) {
    return {
      associations: Array.from(associations.keys()).map((key) => {
        const [description, direction] = key.split('$');
        return {
          description,
          direction: direction as Direction,
          nodeEdgePairs: associations.get(key).map((pair) => {
            return {
              node: {
                id: pair.node.id,
                displayName: pair.node.displayName,
                label: pair.node.primaryLabel,
              },
              edge: {
                originalFrom: pair.edge.originalFrom,
                originalTo: pair.edge.originalTo,
                label: pair.edge.label,
              },
            } as ReferenceTablePair;
          }),
        } as ReferenceTableDataRequest;
      }),
    } as BulkReferenceTableDataRequest;
  }

  getDuplicateNodeEdgePairsFromCluster(clusterNodeId: IdType) {
    const clusteredNodeIds = this.networkGraph.getNodesInCluster(clusterNodeId);
    const duplicateNodeEdgePairs = [];

    clusteredNodeIds.forEach((nodeId) => {
      this.networkGraph.getConnectedEdges(nodeId).forEach((edgeId) => {
        duplicateNodeEdgePairs.push({
          node: this.nodes.get(nodeId),
          edge: this.edges.get(edgeId),
        } as DuplicateNodeEdgePair);
      });
    });

    return duplicateNodeEdgePairs;
  }

  /**
   * Creates a cluster node of all the neighbors connected to the currently selected
   * node connected by the input relationship.
   * @param groupRequest an object representing the relationship the neighbors will be clustered on
   */
  groupNeighborsWithRelationship(groupRequest: GroupRequest) {
    const { relationship, node, direction } = groupRequest;
    let duplicateNodeEdgePairs: DuplicateNodeEdgePair[] = [];

    const neighborNodesWithRel = this.getNeighborsWithRelationship(relationship, node, direction);

    try {
      const duplicateNodeEdgePairsOutsideCluster = this.createDuplicateNodesAndEdges(
        neighborNodesWithRel,
        relationship,
        node,
        direction
      );
      duplicateNodeEdgePairs = duplicateNodeEdgePairs.concat(duplicateNodeEdgePairsOutsideCluster);

      this.networkGraph.getConnectedNodes(node).forEach((nodeId) => {
        if (this.networkGraph.isCluster(nodeId)) {
          if (this.clusters.get(nodeId).relationship === relationship) {
            // If the hub node is already connected to a cluster on the given relationship,
            // we should include all the nodes in that cluster.
            const duplicateNodesEdgePairsInCluster = this.getDuplicateNodeEdgePairsFromCluster(
              nodeId
            ).filter(
              // It is possible that some of the nodes inside the cluster are also outside it. So,
              // get rid of duplicates.
              (pair: DuplicateNodeEdgePair) => !neighborNodesWithRel.includes(pair.node.duplicateOf)
            );
            duplicateNodeEdgePairs = duplicateNodeEdgePairs.concat(
              duplicateNodesEdgePairsInCluster
            );
          }
        }
      });
    } catch (e) {
      console.log(e);
      this.messageDialog.display({
        title: 'Clustering Error!',
        message:
          `An error occurred while trying to cluster node with ID ${node} on relationship ` +
          `${relationship} in direction '${direction}'. `,
        type: MessageType.Error,
      } as MessageArguments);
      return;
    }

    this.openLoadingClustersDialog();

    // When finished clustering, emit
    this.clusteringSubscription = this.clusterCreatedSource
      .asObservable()
      .pipe(first())
      .subscribe(() => {
        this.finishedClustering.emit(true);
      });

    try {
      this.createCluster(node, relationship, duplicateNodeEdgePairs);
    } catch (error) {
      this.messageDialog.display({
        title: 'Clustering Error',
        message: error,
        type: MessageType.Error,
      } as MessageArguments);
      this.clusteringSubscription.unsubscribe();
      this.openClusteringRequests = 0;
      this.finishedClustering.emit(true);
    }
  }

  removeEdges(edges: IdType[]) {
    edges.forEach((edge) => {
      this.edges.remove(edge);
    });
  }

  // TODO: We need to consider flipping the 'expanded' property of any nodes where after this process finishes, the node
  // no longer has any neighbors. Otherwise, if we remove all the connected nodes from a given node, the user will have to
  // double click on that node twice to re-expand the node.
  removeNodes(nodes: IdType[]) {
    const edgesToRemove = [];
    const nodesToRemove = nodes.map((node) => {
      this.networkGraph.getConnectedNodes(node).forEach((connectedNode) => {
        if (this.networkGraph.isCluster(connectedNode)) {
          this.safelyOpenCluster(connectedNode);
        }
      });
      this.networkGraph.getConnectedEdges(node).forEach((edge) => {
        edgesToRemove.push(edge);
      });
      return node;
    });

    this.nodes.remove(nodesToRemove);
    this.edges.remove(edgesToRemove);
  }

  selectNeighbors(node: IdType) {
    this.networkGraph.selectNodes(this.networkGraph.getConnectedNodes(node) as IdType[]);
    this.updateSelectedNodes();
  }

  openTypeSidenav(type: AssociatedType) {
    this.openSidenav();
    if (
      this.selectedNodes.length === 1 &&
      this.selectedEdges.length === 0 &&
      !this.networkGraph.isCluster(this.selectedNodes[0])
    ) {
      const sourceNode = this.nodes.get(this.selectedNodes[0]) as VisNode;
      const connectedNodeIds = new Set<number>();
      const connectedNodes = [];

      this.networkGraph.getConnectedNodes(sourceNode.id).forEach((connectedNodeId) => {
        if (!this.networkGraph.isCluster(connectedNodeId)) {
          const connectedNode: any = this.nodes.get(connectedNodeId);
          const knowledgeGraphId = connectedNode.duplicateOf || connectedNode.id;

          if (
            connectedNode.primaryLabel === AssociatedType[type] &&
            !connectedNodeIds.has(knowledgeGraphId)
          ) {
            connectedNodeIds.add(knowledgeGraphId);
            if (!isNil(connectedNode.duplicateOf)) {
              connectedNodes.push(this.createOriginalNodeFromDuplicate(connectedNode));
            } else {
              connectedNodes.push(connectedNode);
            }
          }
        }
      });

      this.sidenavEntity = {
        sourceNode,
        connectedNodes,
        type,
      } as SidenavTypeEntity;
      this.sidenavEntityType = SidenavEntityType.TYPE;
      this.getNodeData.emit(true);
    }
  }

  updateSidenavEntity() {
    this.openSidenav();

    if (this.selectedNodes.length === 1 && this.selectedEdges.length === 0) {
      if (this.networkGraph.isCluster(this.selectedNodes[0])) {
        const cluster = this.selectedNodes[0];
        const edges = [];
        this.networkGraph.getNodesInCluster(cluster).forEach((node) =>
          this.networkGraph.getConnectedEdges(node).forEach((edgeId) => {
            const edge = this.edges.get(edgeId) as DuplicateVisEdge;
            edges.push({
              from: edge.from,
              to: edge.to,
              originalFrom: edge.originalFrom,
              originalTo: edge.originalTo,
              fromLabel: edge.fromLabel,
              toLabel: edge.toLabel,
              label: edge.label,
            } as DuplicateEdgeConnectionData);
          })
        );
        this.isNewClusterSidenavEntity = true;
        this.sidenavEntityType = SidenavEntityType.CLUSTER;
        this.sidenavEntity = null; // Set as null until data is returned by parent
        this.getSnippetsError = null; // Clear any errors if any
        this.getSnippetsForCluster.emit({
          page: 1,
          limit: SNIPPET_PAGE_LIMIT,
          queryData: edges,
        } as NewClusterSnippetsPageRequest);
      } else {
        const node = this.nodes.get(this.selectedNodes[0]) as VisNode;
        this.sidenavEntity = {
          data: node,
          edges: this.networkGraph
            .getConnectedEdges(node.id)
            .map((edgeId) => this.edges.get(edgeId)),
        } as SidenavNodeEntity;
        this.sidenavEntityType = SidenavEntityType.NODE;

        // Need to tell the parent that we selected a node so it can cancel any pending requests for edge/cluster data.
        // We don't actually need any data from the parent...at the moment!
        this.getNodeData.emit(true);
      }
    } else if (this.selectedNodes.length === 0 && this.selectedEdges.length === 1) {
      const edge = this.edges.get(this.selectedEdges[0]) as VisEdge;
      this.isNewEdgeSidenavEntity = true;
      this.sidenavEntityType = SidenavEntityType.EDGE;
      this.sidenavEntity = null; // Set as null until data is returned by parent
      this.getSnippetsError = null; // Clear any errors if any
      this.getSnippetsForEdge.emit({
        page: 1,
        limit: SNIPPET_PAGE_LIMIT,
        queryData: {
          from: edge.from,
          to: edge.to,
          fromLabel: edge.fromLabel,
          toLabel: edge.toLabel,
          label: edge.label,
        } as EdgeConnectionData,
      } as NewEdgeSnippetsPageRequest);
    }
  }

  requestNewClusterSnippetsPage(request: NewClusterSnippetsPageRequest) {
    this.isNewClusterSidenavEntity = false;
    this.getSnippetsForCluster.emit(request);
  }

  requestNewEdgeSnippetsPage(request: NewEdgeSnippetsPageRequest) {
    this.isNewEdgeSidenavEntity = false;
    this.getSnippetsForEdge.emit(request);
  }

  /**
   * Contains all of the event handling features for the
   * network graph.
   */
  visualizerSetupEventBinds() {
    this.networkGraph.on('click', (params) => {
      this.onClickCallback(params);
      // TODO: May want to disable some of the default behaviors. For example,
      // if a user selected some nodes, and then clicks anywhere, all the nodes are
      // deselected. This may be contrary to what users expect (e.g. I would expect
      // that if I selected some things and I clicked on one of them I wouldn't
      // deselect everything). There may also be other behaviors we don't want.
    });

    this.networkGraph.on('dragStart', (params) => {
      this.onDragStartCallback(params);
    });

    this.networkGraph.on('dragEnd', (params) => {
      this.onDragEndCallback(params);
    });

    this.networkGraph.on('hoverNode', (params) => {
      this.onHoverNodeCallback(params);
    });

    this.networkGraph.on('blurNode', (params) => {
      this.onBlurNodeCallback(params);
    });

    this.networkGraph.on('selectNode', (params) => {
      this.onSelectNodeCallback(params);
    });

    this.networkGraph.on('selectEdge', (params) => {
      this.onSelectEdgeCallback(params);
    });

    this.networkGraph.on('doubleClick', (params) => {
      this.onDoubleClickCallback(params);
    });

    this.networkGraph.on('oncontext', (params) => {
      this.onContextCallback(params);
    });
  }

  hideAllTooltips() {
    this.contextMenuControlService.hideTooltip();
  }

  // Begin Callback Functions

  onClickCallback(params: any) {
    this.hideAllTooltips();
  }

  onDragStartCallback(params: any) {
    this.hideAllTooltips();
  }

  onDragEndCallback(params: any) {
    // Dragging a node doesn't fire node selection, but it is selected after dragging finishes, so update
    this.updateSelectedNodes();
  }

  onHoverNodeCallback(params: any) {
    if (this.networkGraph.isCluster(params.node)) {
      // TODO LL-974: Add on-hover cluster effects
    } else if (!this.nodes.get(params.node)) {
      // TODO: Add on-hover edge effects
    } else {
      // This produces an 'enlarge effect'
      // TODO: Currently this does nothing, because the size property does not change 'box' shape nodes.
      // May be able to use the 'scaling' property to produce the desired effect.
      // const node = this.nodes.get(params.node);
      // const updatedNode = {...node, size: this.config.nodes.size * 1.5};
      // this.nodes.update(updatedNode);
    }
  }

  onBlurNodeCallback(params: any) {
    if (this.networkGraph.isCluster(params.node)) {
      // TODO: Add on-blur cluster effects
    } else if (!this.nodes.get(params.node)) {
      // TODO: Add on-blur edge effects
    } else {
      // This produces a 'shrink effect'
      // TODO: Currently this does nothing, because the size property does not change 'box' shape nodes.
      // May be able to use the 'scaling' property to produce the desired effect.
      // const node = this.nodes.get(params.node);
      // const updateNode = {...node, size: this.config.nodes.size};
      // this.nodes.update(updateNode);
    }
  }

  onSelectNodeCallback(params: any) {
    this.updateSelectedNodesAndEdges();
  }

  onSelectEdgeCallback(params: any) {
    this.updateSelectedNodesAndEdges();
  }

  onDoubleClickCallback(params: any) {
    const hoveredNode = this.networkGraph.getNodeAt(params.pointer.DOM);

    if (this.networkGraph.isCluster(hoveredNode)) {
      this.safelyOpenCluster(hoveredNode);
      return;
    }

    // Check if event is double clicking a node
    if (hoveredNode) {
      this.toggleNodeExpandState(hoveredNode as string);
    }
  }

  onContextCallback(params: any) {
    const hoveredNode = this.networkGraph.getNodeAt(params.pointer.DOM) as string;
    const hoveredEdge = this.networkGraph.getEdgeAt(params.pointer.DOM);

    if (this.networkGraph.isCluster(hoveredNode)) {
      const nodeIdToSnippetCountMap = new Map<IdType, number>();
      this.clusters
        .get(hoveredNode)
        .referenceTableRows.forEach((nodeRow) =>
          nodeIdToSnippetCountMap.set(nodeRow.nodeId, nodeRow.snippetCount)
        );
      this.selectedClusterNodeData = this.networkGraph
        .getNodesInCluster(hoveredNode)
        .map((nodeId) => this.nodes.get(nodeId) as VisNode)
        .sort(
          (a, b) =>
            nodeIdToSnippetCountMap.get(b.id.toString()) -
            nodeIdToSnippetCountMap.get(a.id.toString())
        )
        .slice(0, this.settingsFormValues.maxClusterShownRows.value);
    } else {
      this.selectedClusterNodeData = [];
    }

    // Stop the browser from showing the normal context
    params.event.preventDefault();

    // Update the canvas location
    const canvas = document
      .getElementById(this.networkContainerId)
      .getBoundingClientRect() as DOMRect;

    const contextMenuXPos = params.pointer.DOM.x + canvas.x;
    const contextMenuYPos = params.pointer.DOM.y + canvas.y;

    this.contextMenuControlService.updatePopper(contextMenuXPos, contextMenuYPos);

    const currentlySelectedNodes = this.networkGraph.getSelectedNodes();
    const currentlySelectedEdges = this.networkGraph.getSelectedEdges();

    if (hoveredNode !== undefined) {
      if (currentlySelectedNodes.length === 0 || !currentlySelectedNodes.includes(hoveredNode)) {
        this.networkGraph.selectNodes([hoveredNode], false);
      }
    } else if (hoveredEdge !== undefined) {
      if (currentlySelectedEdges.length === 0 || !currentlySelectedEdges.includes(hoveredEdge)) {
        this.networkGraph.selectEdges([hoveredEdge]);
      }
    } else {
      this.networkGraph.unselectAll();
    }

    this.updateSelectedNodesAndEdges();

    if (this.selectedNodes.length === 1 && this.selectedEdges.length === 0) {
      this.updateSelectedNodeEdgeLabelData(this.selectedNodes[0]);
    } else {
      // Clean up the selected node edge labels if we selected more than one node, or any edges
      // (this should prevent stale data in the context menu component)
      this.clearSelectedNodeEdgeLabelData();
    }
    this.contextMenuControlService.showTooltip();
  }

  // End Callback Functions

  // Start Dialog Display Functions

  openNoResultsFromExpandDialog() {
    this.messageDialog.display({
      title: 'No Relationships',
      message: 'Expanded node had no connected relationships.',
      type: MessageType.Info,
    } as MessageArguments);
  }

  openLoadingClustersDialog() {
    this.loadingClustersDialogRef = this.progressDialog.display({
      title: `Node Expansion`,
      progressObservables: [
        new BehaviorSubject<Progress>(
          new Progress({
            status: 'Loading clusters...',
          })
        ),
      ],
      onCancel: () => {},
    });
  }

  openErrorDialog(title: string, error: string) {
    this.messageDialog.display({
      title,
      message: error,
      type: MessageType.Error,
    } as MessageArguments);
  }
}
