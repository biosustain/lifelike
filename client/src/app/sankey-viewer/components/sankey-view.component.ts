import { Component, EventEmitter, OnDestroy, ViewChild, isDevMode } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { combineLatest, Subscription, BehaviorSubject } from 'rxjs';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { getAndColorNetworkTraceLinks, getNetworkTraceNodes, colorNodes, getRelatedTraces } from './algorithms/traceLogic';
import { map } from 'rxjs/operators';
import { nodeValueByProperty, noneNodeValue } from './algorithms/nodeValues';
import { linkSizeByArrayProperty, linkSizeByProperty, inputCount, fractionOfFixedNodeValue } from './algorithms/linkValues';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { parseForRendering, isPositiveNumber, createMapToColor } from './utils';
import { uuidv4 } from 'app/shared/utils';
import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import prescalers from 'app/sankey-viewer/components/algorithms/prescalers';
import { ValueGenerator, SankeyAdvancedOptions} from './interfaces';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { SessionStorageService } from '../../shared/services/session-storage.service';
import { nodeLabelAccessor } from '../../trace-viewer/components/utils';
import { cubehelix } from 'd3';
import visNetwork from 'vis-network';
import { shortNodeText } from './sankey/utils';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent {
  networkTraces;
  selectedNetworkTrace;
  paramsSubscription: Subscription;
  returnUrl: string;
  selection: BehaviorSubject<Array<{
    type: string,
    entity: SankeyLink | SankeyNode | object,
    template: HTMLTemplateElement
  }>>;
  selectionWithTraces;
  loadTask: any;
  openSankeySub: Subscription;
  ready = false;
  object?: FilesystemObject;
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  sankeyData: SankeyData;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  filteredSankeyData;
  detailsPanel: boolean;
  advancedPanel: boolean;
  traceDetailsGraph;
  excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node']);
  selectedNodes;
  selectedLinks;
  selectedTraces;
  nodeAlign;
  @ViewChild('traceDetails', {static: true}) traceDetails;
  @ViewChild('linkDetails', {static: true}) linkDetails;
  @ViewChild('nodeDetails', {static: true}) nodeDetails;

  options: SankeyAdvancedOptions = {
    nodeHeight: {
      min: {
        enabled: false,
        value: 0
      },
      max: {
        enabled: false,
        ratio: 10
      }
    },
    normalizeLinks: false,
    linkValueAccessors: [],
    nodeValueAccessors: [],
    predefinedValueAccessors: [{
      description: 'Input count',
      callback: () => {
        this.options.selectedLinkValueAccessor = this.options.linkValueGenerators.find(({description}) => description === 'Input count');
        this.options.selectedNodeValueAccessor = this.options.nodeValueGenerators[0];
        this.onOptionsChange();
      }
    }],
    linkValueGenerators: [
      {
        description: 'Input count',
        preprocessing: inputCount,
        disabled: () => false
      } as ValueGenerator,
      {
        description: 'Fraction of fixed node value',
        disabled: () => this.options.selectedNodeValueAccessor === this.options.nodeValueGenerators[0],
        requires: ({node: {fixedValue}}) => fixedValue,
        preprocessing: fractionOfFixedNodeValue
      } as ValueGenerator
    ],
    nodeValueGenerators: [
      {
        description: 'None',
        preprocessing: noneNodeValue,
        disabled: () => false
      } as ValueGenerator
    ],
    selectedLinkValueAccessor: undefined,
    selectedNodeValueAccessor: undefined,
    selectedPredefinedValueAccessor: undefined,
    prescalers,
    selectedPrescaler: prescalers[0]
  };
  parseProperty = parseForRendering;
  @ViewChild('sankey', {static: false}) sankey;
  isArray = Array.isArray;
  private currentFileId: any;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    private modalService: NgbModal,
    protected readonly workSpaceManager: WorkspaceManager,
    private router: Router,
    private sessionStorage: SessionStorageService
  ) {
    this.options.selectedLinkValueAccessor = this.options.linkValueGenerators[0];
    this.options.selectedNodeValueAccessor = this.options.nodeValueGenerators[0];
    this.options.selectedPredefinedValueAccessor = this.options.predefinedValueAccessors[0];

    this.selection = new BehaviorSubject([]);
    this.selectionWithTraces = this.selection.pipe(
      map((currentSelection) => {
        const nodes = currentSelection.filter(({type}) => type === 'node').map(({entity}) => entity);
        const links = currentSelection.filter(({type}) => type === 'link').map(({entity}) => entity);
        const traces = [...getRelatedTraces({nodes, links})].map(entity => ({
          type: 'trace',
          template: this.traceDetails,
          entity
        }));
        return [...currentSelection].reverse().concat(traces);
      })
    );

    this.selectedNodes = this.selection.pipe(map(currentSelection => {
      return new Set(currentSelection.filter(({type}) => type === 'node').map(({entity}) => entity));
    }));
    this.selectedLinks = this.selection.pipe(map(currentSelection => {
      return new Set(currentSelection.filter(({type}) => type === 'link').map(({entity}) => entity));
    }));


    this.loadTask = new BackgroundTask(([hashId]) => {
      return combineLatest(
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJson()
        )
      );
    });

    this.traceDetailsGraph = new WeakMap();

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openSankeySub = this.loadTask.results$.subscribe(({
                                                             result: [object, content],
                                                           }) => {

      this.sankeyData = this.parseData(content);
      this.applyFilter();
      this.object = object;
      this.emitModuleProperties();

      this.currentFileId = object.hashId;
      this.ready = true;
    });

    this.loadFromUrl();
  }

  parseTraceDetails(trace) {
    const {nodes: mainNodes } = this.sankeyData;

    const edges = (trace.detail_edges || trace.edges).map(([from, to, d]) => ({
      from,
      to,
      id: uuidv4(),
      arrows: 'to',
      label: d.type,
      ...(d || {})
    }));
    const nodeIds = [...edges.reduce((nodesSet, {from, to}) => {
      nodesSet.add(from);
      nodesSet.add(to);
      return nodesSet;
    }, new Set())];
    const nodes: Array<visNetwork.Node> = nodeIds.map(nodeId => {
    const node = mainNodes.find(({id}) => id === nodeId);
    if (node) {
      const color = cubehelix(node._color);
      color.s = 0;
      const label = nodeLabelAccessor(node);
      if (isDevMode() && !label) {
        console.error(`Node ${node.id} has no label property.`, node);
      }
      const {sourceLinks, targetLinks, ...otherProperties} = node;
      return {
        ...otherProperties,
        color: '' + color,
        databaseLabel: node.type,
        label: shortNodeText(node),
        title: label
      };
    } else {
      console.error(`Details nodes should never be implicitly define, yet ${nodeId} has not been found.`);
      return {
        id: nodeId,
        label: nodeId,
        databaseLabel: 'Implicitly defined',
        color: 'red'
      };
    }
  });

    return {
      ...trace,
      nodes,
      edges
    };
  }

  gotoDynamic(trace) {
    const traceDetails = this.parseTraceDetails(trace);
    const id = this.sessionStorage.set(traceDetails);
    const url = `/projects/${this.object.project.name}/trace/${this.object.hashId}/${id}`;
    this.workSpaceManager.navigateByUrl(url, {
      sideBySide: true, newTab: true
    });
  }

  getJSONDetails(details) {
    return JSON.stringify(details, (k, p) => this.parseProperty(p, k), 1);
  }

  getNodeById(nodeId) {
    return (this.filteredSankeyData.nodes.find(({id}) => id === nodeId) || {}) as SankeyNode;
  }


  open(content) {
    this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title', windowClass: 'adaptive-modal', size: 'xl'
    }).result
      .then(_ => _, _ => _);
  }

  // region Zoom
  resetZoom() {
    if (this.sankey) {
      this.sankey.resetZoom();
    }
  }

  zoomIn() {
    if (this.sankey) {
      this.sankey.scaleZoom(1.25);
    }
  }

  zoomOut() {
    if (this.sankey) {
      this.sankey.scaleZoom(.8);
    }
  }
  // endregion

  selectNetworkTrace(networkTrace) {
    this.selectedNetworkTrace = networkTrace;
    const {links, nodes, graph: {node_sets}} = this.sankeyData;
    const traceColorPaletteMap = createMapToColor(
      networkTrace.traces.map(({group}) => group),
      {alpha: _ => 1, saturation: _ => 0.35}
    );
    const networkTraceLinks = getAndColorNetworkTraceLinks(networkTrace, links, traceColorPaletteMap);
    const networkTraceNodes = getNetworkTraceNodes(networkTraceLinks, nodes);
    colorNodes(nodes);
    const inNodes = node_sets[networkTrace.sources];
    const outNodes = node_sets[networkTrace.targets];
    this.nodeAlign = inNodes.length > outNodes.length ? 'Right' : 'Left';
    this.filteredSankeyData = this.linkGraph({
      nodes: networkTraceNodes,
      links: networkTraceLinks,
      inNodes,
      outNodes
    });
  }

  openDetailsPanel() {
    this.detailsPanel = true;
  }

  closeDetailsPanel() {
    this.detailsPanel = false;
    this.resetSelection();
  }

  closeAdvancedPanel() {
    this.advancedPanel = false;
  }

  applyFilter() {
    if (this.selectedNetworkTrace) {
      this.selectNetworkTrace(this.selectedNetworkTrace);
    } else {
      this.filteredSankeyData = this.sankeyData;
    }
  }

  linkGraph(data) {
    data.links.forEach(l => {
      l.id = uuidv4();
    });
    const preprocessedNodes = this.options.selectedNodeValueAccessor.preprocessing(data) || {};
    const preprocessedLinks = this.options.selectedLinkValueAccessor.preprocessing(data) || {};

    Object.assign(data, preprocessedLinks, preprocessedNodes);

    const prescaler = this.options.selectedPrescaler.fn;

    let minValue = data.nodes.reduce((m, n) => {
      if (n.fixedValue !== undefined) {
        n.fixedValue = prescaler(n.fixedValue);
        return Math.min(m, n.fixedValue);
      }
      return m;
    }, 0);
    minValue = data.links.reduce((m, l) => {
      l.value = prescaler(l.value);
      if (l.multiple_values) {
        l.multiple_values = l.multiple_values.map(prescaler);
        return Math.min(m, ...l.multiple_values);
      }
      return Math.min(m, l.value);
    }, minValue);
    if (this.options.selectedNodeValueAccessor.postprocessing) {
      Object.assign(data, this.options.selectedNodeValueAccessor.postprocessing(data) || {});
    }
    if (this.options.selectedLinkValueAccessor.postprocessing) {
      Object.assign(data, this.options.selectedLinkValueAccessor.postprocessing(data) || {});
    }
    if (minValue < 0) {
      data.nodes.forEach(n => {
        if (n.fixedValue !== undefined) {
          n.fixedValue = n.fixedValue - minValue;
        }
      });
      data.links.forEach(l => {
        l.value = l.value - minValue;
        if (l.multiple_values) {
          l.multiple_values = l.multiple_values.map(v => v - minValue);
        }
      });
    }

    return data;
  }

  sankeyLayoutAdjustment({data, extent: [[_marginLeft, marginTop], [_width, height]]}) {
    const {inNodes = [], outNodes = []} = this.filteredSankeyData;
    const traverseRight = inNodes.length < outNodes.length;
    const nextNodes = traverseRight ?
      node => node.sourceLinks.map(({target}) => target) :
      node => node.targetLinks.map(({source}) => source);
    let nodes = (traverseRight ? inNodes : outNodes).map(n => data.nodes.find(({id}) => id === n.id));
    if (!nodes.filter(n => n).length) {
      const accessor = traverseRight ? 'targetLinks' : 'sourceLinks';
      nodes = data.nodes.filter(n => n[accessor].length === 0);
    }
    const visited = new Set();
    let order = 0;
    const relayout = ns => {
      ns.forEach(node => {
        if (visited.has(node)) {
          return;
        }
        visited.add(node);
        node._order = order++;
        relayout(nextNodes(node));
      });
    };
    relayout(nodes);
    const columns = data.nodes.reduce((o, n) => {
      const column = o.get(n.layer);
      if (column) {
        column.push(n);
      } else {
        o.set(n.layer, [n]);
      }
      return o;
    }, new Map());
    [...columns.values()].forEach(column => {
      const {length} = column;
      const nodesHeight = column.reduce((o, {y0, y1}) => o + y1 - y0, 0);
      const additionalSpacers = length === 1 || ((nodesHeight / height) < 0.75);
      const freeSpace = height - nodesHeight;
      const spacerSize = freeSpace / (additionalSpacers ? length + 1 : length - 1);
      let y = additionalSpacers ? spacerSize + marginTop : marginTop;
      column.sort((a, b) => a._order - b._order).forEach(node => {
        let nodeHeight = node.y1 - node.y0;
        if (this.options.nodeHeight.max.enabled) {
          nodeHeight = Math.min(nodeHeight, this.options.nodeHeight.max.ratio * 10);
        }
        if (this.options.nodeHeight.min.enabled) {
          nodeHeight = Math.max(nodeHeight, this.options.nodeHeight.min.value);
        }
        node.y0 = y;
        node.y1 = y + nodeHeight;
        y += nodeHeight + spacerSize;
      });
    });
    const reverseAccessor = traverseRight ? 'targetLinks' : 'sourceLinks';
    const depthSorter = traverseRight ? (a, b) => b.depth - a.depth : (a, b) => a.depth - b.depth;
    const groupOrder = [...
      data.nodes
        .sort((a, b) => depthSorter(a, b) || a._order - b._order)
        .reduce((o, d) => {
          d[reverseAccessor].forEach(l => o.add(l._trace.group));
          return o;
        }, new Set())
    ];
    const sort = (a, b) =>
      (b.source.index - a.source.index) ||
      (b.target.index - a.target.index) ||
      (groupOrder.indexOf(a._trace.group) - groupOrder.indexOf(b._trace.group));
    for (const {sourceLinks, targetLinks} of data.nodes) {
      sourceLinks.sort(sort);
      targetLinks.sort(sort);
    }
  }

  extractLinkValueProperties([link = {}]) {
    // extract all numeric properties
    this.options.linkValueAccessors = Object.entries(link).reduce((o, [k, v]) => {
      if (this.excludedProperties.has(k)) {
        return o;
      }
      if (isPositiveNumber(v)) {
        o.push({
          description: k,
          preprocessing: linkSizeByProperty(k),
          postprocessing: ({links}) => {
            links.forEach(l => {
              l.value /= (l._adjacent_divider || 1);
              // take max for layer calculation
            });
          }
        });
      } else if (Array.isArray(v) && v.length === 2 && isPositiveNumber(v[0]) && isPositiveNumber(v[1])) {
        o.push({
          description: k,
          preprocessing: linkSizeByArrayProperty(k),
          postprocessing: ({links}) => {
            links.forEach(l => {
              l.multiple_values = l.multiple_values.map(d => d / (l._adjacent_divider || 1));
              // take max for layer calculation
            });
          }
        });
      }
      return o;
    }, []);
  }

  extractNodeValueProperties([node = {}]) {
    // extract all numeric properties
    this.options.nodeValueAccessors = Object.entries(node).reduce((o, [k, v]) => {
      if (this.excludedProperties.has(k)) {
        return o;
      }
      if (isPositiveNumber(v)) {
        o.push({
          description: k,
          preprocessing: nodeValueByProperty(k)
        });
      }
      return o;
    }, []);
  }

  extractPredefinedValueProperties({sizing = {}}: { sizing: SankeyPredefinedSizing }) {
    this.options.predefinedValueAccessors = this.options.predefinedValueAccessors.concat(
      Object.entries(sizing).map(([name, {node_sizing, link_sizing}]) => ({
        description: name,
        callback: () => {
          if (node_sizing) {
            const nodeValueAccessor = this.options.nodeValueAccessors.find(({description}) => description === node_sizing);
            this.options.selectedNodeValueAccessor = nodeValueAccessor;
          } else {
            const nodeValueAccessor = this.options.nodeValueGenerators[0];
            this.options.selectedNodeValueAccessor = nodeValueAccessor;
          }
          if (link_sizing) {
            const linkValueAccessor = this.options.linkValueAccessors.find(({description}) => description === link_sizing);
            this.options.selectedLinkValueAccessor = linkValueAccessor;
          } else {
            this.options.selectedLinkValueAccessor = this.options.linkValueGenerators[1];
          }
          this.onOptionsChange();
        }
      })));
  }

  parseData({links, graph, nodes, ...data}) {
    this.networkTraces = graph.trace_networks;
    this.selectedNetworkTrace = this.networkTraces[0];
    this.extractLinkValueProperties(links);
    this.extractNodeValueProperties(nodes);
    this.extractPredefinedValueProperties(graph);
    return {
      ...data,
      graph,
      links,
      nodes
    } as SankeyData;
  }

  loadFromUrl() {
    // Check if the component was loaded with a url to parse fileId
    // from
    if (this.route.snapshot.params.file_id) {
      this.object = null;
      this.currentFileId = null;

      const linkedFileId = this.route.snapshot.params.file_id;
      this.openSankey(linkedFileId);
    }
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.loadFromUrl();
    }
  }

  /**
   * Open sankey by file_id along with location to scroll to
   * @param hashId - represent the sankey to open
   */
  openSankey(hashId: string) {
    if (this.object != null && this.currentFileId === this.object.hashId) {
      return;
    }
    this.ready = false;

    this.loadTask.update([hashId]);
  }

  ngOnDestroy() {
    this.paramsSubscription.unsubscribe();
    this.openSankeySub.unsubscribe();
  }

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.object.filename,
      fontAwesomeIcon: 'file-chart-line',
    });
  }

  onOptionsChange() {
    this.selectNetworkTrace(this.selectedNetworkTrace);
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.object.filename);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: this.object.filename,
      label: 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.object.hashId + '',
        }],
        sources: [{
          domain: this.object.filename,
          url: ['/projects', encodeURIComponent(this.object.project.name),
            'sankey', encodeURIComponent(this.object.hashId)].join('/'),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

  toggleSelect(entity, type, template: HTMLTemplateElement) {
    const currentSelection = this.selection.value;
    const idxOfSelectedLink = currentSelection.findIndex(
      d => d.type === type && d.entity === entity
    );

    if (idxOfSelectedLink !== -1) {
      currentSelection.splice(idxOfSelectedLink, 1);
    } else {
      currentSelection.push({
        type,
        entity,
        template
      });
    }

    this.selection.next(currentSelection);
  }

  selectNode(node) {
    this.toggleSelect(node, 'node', this.nodeDetails);
  }

  selectLink(link) {
    this.toggleSelect(link, 'link', this.linkDetails);
  }

  resetSelection() {
    this.selection.next([]);
    this.filteredSankeyData.nodes.forEach(n => {
      delete n._selected;
    });
    this.filteredSankeyData.links.forEach(l => {
      delete l._selected;
    });
  }

  selectPredefinedValueAccessor(accessor) {
    this.options.selectedPredefinedValueAccessor = accessor;
    accessor.callback();
  }

  openNodeDetails(node) {
    this.selectNode(node);
    this.openDetailsPanel();
  }

  openLinkDetails(link) {
    this.selectLink(link);
    this.openDetailsPanel();
  }
}
