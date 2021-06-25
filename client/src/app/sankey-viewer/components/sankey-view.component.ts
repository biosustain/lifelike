import { Component, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, Subscription, BehaviorSubject } from 'rxjs';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { uuidv4 } from '../../shared/utils';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { parseForRendering, isPositiveNumber } from './utils';
import {
  getAndColorNetworkTraceLinks,
  getNetworkTraceNodes,
  colorNodes,
  getTraceDetailsGraph,
  getRelatedTraces
} from './algorithms/algorithms';

import { Options } from 'vis-network';
import { networkEdgeSmoothers } from '../../shared/components/vis-js-network/vis-js-network.component';
import { map } from 'rxjs/operators';
import prescalers from './algorithms/prescalers';
import { nodeValueByProperty, noneNodeValue } from './algorithms/nodeValues';
import { linkSizeByArrayProperty, linkSizeByProperty, inputCount, fractionOfFixedNodeValue } from './algorithms/linkValues';

interface ValueGenerator {
  description: string;
  preprocessing: (v: SankeyData) => Partial<SankeyData> | undefined;
  postprocessing?: (v: SankeyData) => Partial<SankeyData> | undefined;
}
import { ErrorHandler } from '../../shared/services/error-handler.service';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent {

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    private modalService: NgbModal,
    protected readonly errorHandler: ErrorHandler
  ) {
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

  networkTraces;
  selectedNetworkTrace;

  @Output() requestClose: EventEmitter<any> = new EventEmitter();

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
  // Type information coming from interface sankeySource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  sankeyData: SankeyData;
  sankeyFileLoaded = false;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  private currentFileId: any;
  filteredSankeyData;

  traceGroupColorMap;

  panelOpened;
  details;
  normalizeLinks = {value: false};

  linkValueGenerators = [
    {
      description: 'Fraction of fixed node value',
      disabled: () => this.selectedNodeValueAccessor === this.nodeValueGenerators[0],
      requires: ({node: {fixedValue}}) => fixedValue,
      preprocessing: fractionOfFixedNodeValue
    } as ValueGenerator,
    {
      description: 'Input count',
      preprocessing: inputCount
    } as ValueGenerator
  ];
  nodeValueGenerators = [
    {
      description: 'None',
      preprocessing: noneNodeValue
    } as ValueGenerator
  ];
  linkValueAccessors;
  selectedLinkValueAccessor = this.linkValueGenerators[1];
  nodeValueAccessors;
  selectedNodeValueAccessor = this.nodeValueGenerators[0];
  prescalers = prescalers;
  selectedPrescaler = this.prescalers[0];

  traceDetailsGraph;

  excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node']);

  selectedNodes;
  selectedLinks;
  selectedTraces;

  @ViewChild('traceDetails', {static: true}) traceDetails;
  @ViewChild('linkDetails', {static: true}) linkDetails;
  @ViewChild('nodeDetails', {static: true}) nodeDetails;

  nodeHeight = {
    min: {
      enabled: false,
      value: 0
    },
    max: {
      enabled: false,
      ratio: 10
    }
  };

  traceDetailsConfig: Options = {
    physics: {
      enabled: false,
      barnesHut: {
        avoidOverlap: 0.9,
        centralGravity: 0.001,
        damping: 0.6,
        gravitationalConstant: -10000,
        springLength: 250,
      },
      stabilization: {
        enabled: false
      }
    },
    edges: {
      smooth: {
        type: networkEdgeSmoothers.DYNAMIC, enabled: true, roundness: 0
      }
    },
    nodes: {
      shape: 'dot'
    }
  };

  parseProperty = parseForRendering;

  @ViewChild('sankey', {static: false}) sankey;

  isArray = Array.isArray;


  getJSONDetails(details) {
    return JSON.stringify(details, (k, p) => this.parseProperty(p, k), 1);
  }

  getNodeById(nodeId) {
    return (this.filteredSankeyData.nodes.find(({id}) => id === nodeId) || {}) as SankeyNode;
  }


  open(content) {
    this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title', windowClass: 'adaptive-modal', size: 'xl'}).result
      .then(_ => _, _ => _);
  }

  getTraceDetailsGraph(trace) {
    let r = this.traceDetailsGraph.get(trace);
    if (!r) {
      if (!trace.detail_edges) {
        this.errorHandler.showError(new Error('No detail_edges defined therefore details view could not be rendered.'));
        r = {
          nodes: [],
          edges: []
        };
      } else {
        r = getTraceDetailsGraph(trace, this.sankeyData);
      }
      this.traceDetailsGraph.set(trace, r);
    }
    return r;
  }

  resetZoom() {
    if (this.sankey) {
      this.sankey.resetZoom();
    }
  }

  selectNetworkTrace(networkTrace) {
    this.selectedNetworkTrace = networkTrace;
    const {links, nodes, graph: {node_sets}} = this.sankeyData;
    const networkTraceLinks = getAndColorNetworkTraceLinks(networkTrace, links);
    const networkTraceNodes = getNetworkTraceNodes(networkTraceLinks, nodes);
    colorNodes(nodes);
    this.filteredSankeyData = this.linkGraph({
      nodes: networkTraceNodes,
      links: networkTraceLinks,
      inNodes: node_sets[networkTrace.sources],
      outNodes: node_sets[networkTrace.targets]
    });
  }

  openDetailsPanel() {
    this.panelOpened = true;
  }

  closePanel() {
    this.panelOpened = false;
    this.resetSelection();
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
    const preprocessedNodes = this.selectedNodeValueAccessor.preprocessing(data) || {};
    const preprocessedLinks = this.selectedLinkValueAccessor.preprocessing(data) || {};

    Object.assign(data, preprocessedLinks, preprocessedNodes);

    const prescaler = this.selectedPrescaler.fn;

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
    if (this.selectedNodeValueAccessor.postprocessing) {
      Object.assign(data, this.selectedNodeValueAccessor.postprocessing(data) || {});
    }
    if (this.selectedLinkValueAccessor.postprocessing) {
      Object.assign(data, this.selectedLinkValueAccessor.postprocessing(data) || {});
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

  sankeyLayoutAdjustment({data, extent: [[marginLeft, marginTop], [width, height]]}) {
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
      ns.forEach((node, idx, arr) => {
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
      column.sort((a, b) => a._order - b._order).forEach((node, idx, arr) => {
        let nodeHeight = node.y1 - node.y0;
        if (this.nodeHeight.max.enabled) {
          nodeHeight = Math.min(nodeHeight, this.nodeHeight.max.ratio * 10);
        }
        if (this.nodeHeight.min.enabled) {
          nodeHeight = Math.max(nodeHeight, this.nodeHeight.min.value);
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
    this.linkValueAccessors = Object.entries(link).reduce((o, [k, v]) => {
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
    this.nodeValueAccessors = Object.entries(node).reduce((o, [k, v]) => {
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


  parseData({links, graph, nodes, ...data}) {
    this.networkTraces = graph.trace_networks;
    this.selectedNetworkTrace = this.networkTraces[0];
    this.extractLinkValueProperties(links);
    this.extractNodeValueProperties(nodes);
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
    this.sankeyFileLoaded = false;
    this.ready = false;

    this.loadTask.update([hashId]);
  }

  ngOnDestroy() {
    this.paramsSubscription.unsubscribe();
    this.openSankeySub.unsubscribe();
  }


  close() {
    this.requestClose.emit(null);
  }

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.object.filename,
      fontAwesomeIcon: 'file-chart-line',
    });
  }

  selectValueAccessor($event) {
    this.selectedLinkValueAccessor = $event;
    this.selectNetworkTrace(this.selectedNetworkTrace);
  }

  selectNodeValueAccessor($event) {
    this.selectedNodeValueAccessor = $event;
    this.selectNetworkTrace(this.selectedNetworkTrace);
  }

  selectPrescaler($event) {
    this.selectedPrescaler = $event;
    this.selectNetworkTrace(this.selectedNetworkTrace);
  }

  updateNormalize() {
    this.selectNetworkTrace(this.selectedNetworkTrace);
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.object.filename);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
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

  openNodeDetails(node) {
    this.selectNode(node);
    this.openDetailsPanel();
  }

  openLinkDetails(link) {
    this.selectLink(link);
    this.openDetailsPanel();
  }

  changeLinkSize($event: any) {
    this.selectedLinkValueAccessor = $event;
    this.selectNetworkTrace(this.selectedNetworkTrace);
  }
}
