import { Component, EventEmitter, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import * as CryptoJS from 'crypto-js';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { combineLatest, Subscription, BehaviorSubject } from 'rxjs';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { map } from 'rxjs/operators';
import { nodeValueByProperty, noneNodeValue } from './algorithms/nodeValues';
import { linkSizeByArrayProperty, linkSizeByProperty, inputCount, fractionOfFixedNodeValue } from './algorithms/linkValues';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { parseForRendering, isPositiveNumber } from './utils';
import { uuidv4 } from 'app/shared/utils';
import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import prescalers from 'app/sankey-viewer/components/algorithms/prescalers';
import { ValueGenerator, SankeyAdvancedOptions } from './interfaces';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { SessionStorageService } from 'app/shared/services/session-storage.service';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { CustomisedSankeyLayoutService } from '../services/customised-sankey-layout.service';
import { SankeyLayoutService } from './sankey/sankey-layout.service';
import { linkPalettes, createMapToColor, DEFAULT_ALPHA, DEFAULT_SATURATION } from './color-palette';


@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
  providers: [
    CustomisedSankeyLayoutService, {
      provide: SankeyLayoutService,
      useExisting: CustomisedSankeyLayoutService
    }
  ]
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
    selectedPrescaler: prescalers.default,
    linkPalettes,
    selectedLinkPalette: linkPalettes.default,
    labelEllipsis: {
      enabled: true,
      value: SankeyLayoutService.labelEllipsis
    },
    fontSize: 12,
    fontSizeScale: 1.0
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
    private sessionStorage: SessionStorageService,
    private readonly filesystemObjectActions: FilesystemObjectActions,
    private sankeyLayout: CustomisedSankeyLayoutService
  ) {
    this.options.selectedLinkValueAccessor = this.options.linkValueGenerators[0];
    this.options.selectedNodeValueAccessor = this.options.nodeValueGenerators[0];
    this.options.selectedPredefinedValueAccessor = this.options.predefinedValueAccessors[0];
    this.options.selectedLinkPalette = this.options.linkPalettes.default,

    this.selection = new BehaviorSubject([]);
    this.selectionWithTraces = this.selection.pipe(
      map((currentSelection) => {
        const nodes = currentSelection.filter(({type}) => type === 'node').map(({entity}) => entity);
        const links = currentSelection.filter(({type}) => type === 'link').map(({entity}) => entity);
        const traces = [
          ...this.sankeyLayout.getRelatedTraces({nodes, links})
        ].map(entity => ({
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

  gotoDynamic(trace) {
    const hash = CryptoJS.MD5(JSON.stringify({
      ...this.selectedNetworkTrace,
      traces: [],
      source: trace.source,
      target: trace.target
    })).toString();
    const url = `/projects/${this.object.project.name}/trace/${this.object.hashId}/${hash}`;

    window.open(url);
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
    const {palette} = this.options.selectedLinkPalette;
    const traceColorPaletteMap = createMapToColor(
      networkTrace.traces.map(({group}) => group),
      {alpha: _ => DEFAULT_ALPHA, saturation: _ => DEFAULT_SATURATION},
      palette
    );
    const networkTraceLinks = this.sankeyLayout.getAndColorNetworkTraceLinks(networkTrace, links, traceColorPaletteMap);
    const networkTraceNodes = this.sankeyLayout.getNetworkTraceNodes(networkTraceLinks, nodes);
    this.sankeyLayout.colorNodes(nodes);
    const _inNodes = node_sets[networkTrace.sources];
    const _outNodes = node_sets[networkTrace.targets];
    this.nodeAlign = _inNodes.length > _outNodes.length ? 'right' : 'left';
    this.filteredSankeyData = this.linkGraph({
      nodes: networkTraceNodes,
      links: networkTraceLinks,
      _inNodes, _outNodes
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
      if (n._fixedValue !== undefined) {
        n._fixedValue = prescaler(n._fixedValue);
        return Math.min(m, n._fixedValue);
      }
      return m;
    }, 0);
    minValue = data.links.reduce((m, l) => {
      l._value = prescaler(l._value);
      if (l._multiple_values) {
        l._multiple_values = l._multiple_values.map(prescaler);
        return Math.min(m, ...l._multiple_values);
      }
      return Math.min(m, l._value);
    }, minValue);
    if (this.options.selectedNodeValueAccessor.postprocessing) {
      Object.assign(data, this.options.selectedNodeValueAccessor.postprocessing(data) || {});
    }
    if (this.options.selectedLinkValueAccessor.postprocessing) {
      Object.assign(data, this.options.selectedLinkValueAccessor.postprocessing(data) || {});
    }
    if (minValue < 0) {
      data.nodes.forEach(n => {
        if (n._fixedValue !== undefined) {
          n._fixedValue = n._fixedValue - minValue;
        }
      });
      data.links.forEach(l => {
        l._value = l._value - minValue;
        if (l._multiple_values) {
          l._multiple_values = l._multiple_values.map(v => v - minValue);
        }
      });
    }

    return data;
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
              l._value /= (l._adjacent_divider || 1);
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
              l._multiple_values = l._multiple_values.map(d => d / (l._adjacent_divider || 1));
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
          const { options } = this;
          const {
            nodeValueAccessors,
            nodeValueGenerators,
            linkValueAccessors,
            linkValueGenerators
          } = options;
          if (node_sizing) {
            options.selectedNodeValueAccessor = nodeValueAccessors.find(
              ({description}) => description === node_sizing
            );
          } else {
            options.selectedNodeValueAccessor = nodeValueGenerators[0];
          }
          if (link_sizing) {
            options.selectedLinkValueAccessor = linkValueAccessors.find(
              ({description}) => description === link_sizing
            );
          } else {
            options.selectedLinkValueAccessor = linkValueGenerators[1];
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
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    });
  }

  openNewWindow() {
    this.filesystemObjectActions.openNewWindow(this.object);
  }

  onOptionsChange() {
    this.sankeyLayout.nodeHeight = {...this.options.nodeHeight};
    this.sankeyLayout.labelEllipsis = {...this.options.labelEllipsis};
    this.sankeyLayout.fontSize = this.options.fontSize;
    this.sankeyLayout.fontSizeScale = this.options.fontSizeScale;
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
