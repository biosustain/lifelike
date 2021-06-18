import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
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
import { parseForRendering } from './utils';
import {
  fractionOfFixedNodeValue,
  inputCount,
  noneNodeValue,
  getAndColorNetworkTraceLinks,
  getNetworkTraceNodes,
  colorNodes,
  linkSizeByProperty,
  linkSizeByArrayProperty,
  nodeValueByProperty,
  getTraceDetailsGraph,
  getRelatedTraces
} from './algorithms';

import { Options } from 'vis-network';
import { networkEdgeSmoothers } from '../../shared/components/vis-js-network/vis-js-network.component';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent {

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    private modalService: NgbModal
  ) {
    this.selectedNodes = new BehaviorSubject(new Set());
    this.selectedLinks = new BehaviorSubject(new Set());

    this.selection = combineLatest([
      this.selectedNodes,
      this.selectedLinks
    ]).pipe(
      map(([nodes, links]) => ({
        traces: getRelatedTraces({nodes, links}),
        nodes, links
      }))
    );

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

  selection;

  loadTask: any;
  openSankeySub: Subscription;
  ready = false;
  object?: FilesystemObject;
  // Type information coming from interface sankeySource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  sankeyData;
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
    },
    {
      description: 'Input count',
      preprocessing: inputCount
    }
  ];
  nodeValueGenerators = [
    {
      description: 'None',
      preprocessing: noneNodeValue
    }
  ];
  linkValueAccessors;
  selectedLinkValueAccessor = this.linkValueGenerators[1];
  nodeValueAccessors;
  selectedNodeValueAccessor = this.nodeValueGenerators[0];

  traceDetailsGraph;

  excludedProperties = new Set(['source', 'target']);

  selectedNodes;
  selectedLinks;
  selectedTraces;

  traceDetailsConfig: Options = {
    physics: {
      enabled: true,
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


  getJSONDetails(details) {
    return JSON.stringify(details, (k, p) => this.parseProperty(p, k), 1);
  }

  getNodeById(nodeId) {
    return (this.filteredSankeyData.nodes.find(({id}) => id === nodeId) || {}) as Node;
  }


  open(content) {
    this.modalService.open(content, {ariaLabelledBy: 'modal-basic-title', windowClass: 'fillHeightModal', size: 'xl'}).result
      .then(_ => _);
  }

  getTraceDetailsGraph(trace) {
    let r = this.traceDetailsGraph.get(trace);
    if (!r) {
      r = getTraceDetailsGraph(trace, this.sankeyData);
      this.traceDetailsGraph.set(trace, r);
    }
    return r;
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
      inNodes: node_sets[networkTrace.sources]
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
    return Object.assign(data, preprocessedLinks, preprocessedNodes);
  }

  extractLinkValueProperties([link = {}]) {
    // extract all numeric properties
    this.linkValueAccessors = Object.entries(link).reduce((o, [k, v]) => {
      if (this.excludedProperties.has(k)) {
        return o;
      }
      if (!isNaN(v as number)) {
        o.push({
          description: k,
          preprocessing: linkSizeByProperty(k)
        });
      } else if (Array.isArray(v) && v.length >= 2 && !isNaN(v[0]) && !isNaN(v[1])) {
        o.push({
          description: k,
          preprocessing: linkSizeByArrayProperty(k)
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
      if (!isNaN(v as number)) {
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
      // link graph
      ...this.linkGraph({
        links,
        nodes,
        inNodes: graph.node_sets.updown
      })
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

  updateNormalize() {
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

  selectNode(node) {
    const selectedNodes = this.selectedNodes.value;
    if (selectedNodes.has(node)) {
      selectedNodes.delete(node);
    } else {
      selectedNodes.add(node);
    }
    this.selectedNodes.next(new Set(selectedNodes));
  }

  selectLink(link) {
    const selectedLinks = this.selectedLinks.value;

    if (selectedLinks.has(link)) {
      selectedLinks.delete(link);
    } else {
      selectedLinks.add(link);
    }

    this.selectedLinks.next(new Set(selectedLinks));
  }

  resetSelection() {
    this.selectedNodes.next(new Set());
    this.selectedLinks.next(new Set());
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
