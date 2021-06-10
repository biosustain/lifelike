import { Component, EventEmitter, OnDestroy, Output, TemplateRef, ViewChild, isDevMode } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, Subscription } from 'rxjs';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { createMapToColor, SankeyGraph, nodeLabelAccessor, christianColors, representativePositiveNumber } from './sankey/utils';
import { uuidv4 } from '../../shared/utils';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GraphData } from '../../interfaces/vis-js.interface';
import { computeNodeLinks, computeNodeDepths, computeNodeLayers } from './sankey/d3-sankey';
import { identifyCircles } from './sankey/d3-sankey-circular';


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

  @ViewChild('nodeDetails', {static: false}) nodeDetails: TemplateRef<any>;
  @ViewChild('linkDetails', {static: false}) linkDetails: TemplateRef<any>;

  networkTraces;
  selectedTrace;

  @Output() requestClose: EventEmitter<any> = new EventEmitter();

  paramsSubscription: Subscription;
  returnUrl: string;

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
  filtersPanelOpened;
  filteredSankeyData;
  filter;

  allTraces = new Set();
  nodesColorMap = new Map();

  inNodesId;
  outNodesId;

  linksColorMap;

  panelOpened;
  details;

  valueGenerators = [
    {
      description: 'Input count',
      preprocessing: ({links, nodes, inNodes}) => {
        // just link graph instead of calculating whole layout
        computeNodeLinks({nodes, links});
        identifyCircles({nodes, links});
        computeNodeDepths({nodes});
        computeNodeLayers({nodes});
        nodes.sort((a, b) => a.depth - b.depth).forEach(n => {
          if (inNodes.includes(n.id)) {
            n.value = 1;
          } else {
            n.value = 0;
          }
          n.value = n.targetLinks.reduce((a, l) => a + l.value, n.value || 0);
          const outFrac = n.value / n.sourceLinks.length;
          n.sourceLinks.forEach(l => {
            l.value = outFrac;
          });
        });
        return {
          nodes: nodes.filter(n => n.sourceLinks.length + n.targetLinks.length > 0).map(({value, ...node}) => (node)),
          links: links.map(({
                              source,
                              target,
                              value = 0.001,
                              path,
                              ...link
                            }) => ({
            ...link,
            source: source.id,
            target: target.id,
            value
          }))
        };
      }
    }
  ];
  valueAccessors;
  selectedValueAccessor = this.valueGenerators[0];

  traceDetailsGraph;

  getNodeById(nodeId) {
    return this.filteredSankeyData.nodes.find(({id}) => id === nodeId) || {};
  }


  open(content) {
    this.modalService.open(content, {ariaLabelledBy: 'modal-basic-title', windowClass: 'fillHeightModal', size: 'xl'}).result
      .then((result) => {
      });
  }

  filterIsolated({links, nodes, ...graph}) {
    computeNodeLinks({links, nodes, ...graph}, ({id}) => id);
    if (isDevMode()) {
      console.table({
        links: links.filter(({source, target}) => !(source && target)),
        nodes: nodes.filter(({sourceLinks, targetLinks}) => !(sourceLinks.length + targetLinks.length > 0))
      });
    }
    return {
      ...graph,
      links: links.filter(({source, target}) => source && target),
      nodes: nodes.filter(({sourceLinks, targetLinks}) => sourceLinks.length + targetLinks.length > 0)
    };
  }

  getTraceDetailsGraph(trace) {
    let r = this.traceDetailsGraph.get(trace);
    if (!r) {
      const nodesIds = [].concat(...trace.node_paths);
      r = {
        edges: trace.detail_edges.map(([from, to, d]) => ({
          from, to, id: uuidv4(), arrows: 'to', label: d.type, ...(d || {})
        })),
        nodes:
          this.filteredSankeyData.nodes.filter(({id}) => nodesIds.includes(id)).map(n => ({
            ...n,
            color: undefined,
            databaseLabel: n.type,
            label: n.name[0]
          }))
      } as GraphData;
      this.traceDetailsGraph.set(trace, r);
    }
    return r;
  }

  selectTrace(trace) {
    this.linksColorMap = new Map(trace.traces.map((t, i) => [t, christianColors[i]]));
    this.selectedTrace = trace;
    const {links, nodes, graph: {node_sets}} = this.sankeyData;
    const allEdges = trace.traces.reduce((o, itrace, idx) => {
      const color = this.linksColorMap.get(itrace);
      const ilinks = itrace.edges.map(iidx => {
        const link = {
          ...links[iidx],
          schemaClass: color,
          trace: itrace
        };
        link.id += itrace;
        return link;
      });
      return o.concat(ilinks);
    }, []);
    const allNodesIds = trace.traces.reduce((o, itrace, idx) =>
        itrace.node_paths.reduce((io, n) =>
            io.concat(n)
          , o)
      , []
    );
    const allNodes = [...(new Set(allNodesIds))].map(idx => nodes.find(({id}) => id === idx));
    this.filteredSankeyData = this.linkGraph({
      nodes: allNodes,
      links: allEdges,
      inNodes: node_sets[trace.sources]
    });
  }

  resolveFilteredNodesLinks(nodes) {
    let newLinks = [];
    let oldLinks = [];
    nodes.forEach(node => {
      oldLinks = oldLinks.concat(node.sourceLinks, node.targetLinks);
      const nodeNewLinks = node.sourceLinks.reduce((inewLinks, sl, sIter) => {
        const targetNode = sl.target;
        const targetIndex = targetNode.targetLinks.findIndex(l => l === sl);
        targetNode.targetLinks.splice(targetIndex, 1);
        return node.targetLinks.reduce((iinewLinks, tl, tIter) => {
          // used for link initial position after creation
          const templateLink = sIter % 2 ? sl : tl;
          const sourceNode = tl.source;
          const newLink = {
            ...templateLink,
            folded: true,
            id: uuidv4(),
            source: sourceNode,
            target: targetNode,
            value: ((sl.value + tl.value) / 2) || 1,
            path: `${tl.path} => ${nodeLabelAccessor(node)} => ${sl.path}`
          };
          iinewLinks.push(newLink);
          if (!tIter) {
            const sourceIndex = sourceNode.sourceLinks.findIndex(l => l === tl);
            sourceNode.sourceLinks.splice(sourceIndex, 1);
          }
          sourceNode.sourceLinks.push(newLink);
          targetNode.targetLinks.push(newLink);
          return iinewLinks;
        }, inewLinks);
      }, []);
      newLinks = newLinks.concat(nodeNewLinks);
      // corner case - starting or ending node
      if (!nodeNewLinks.length) {
        // console.log(newLinks, oldLinks);
      }
    });
    return {
      newLinks,
      oldLinks
    };
  }


  changeFilter(filter = d => d) {
    // this.filter = filter;
    // const {nodes, links, ...data} = this.sankeyData;
    // const [filteredNodes, filteredOutNodes] = nodes.reduce(([ifilteredNodes, ifilteredOutNodes], n) => {
    //   if (filter(n).hidden) {
    //     ifilteredOutNodes.push(n);
    //   } else {
    //     ifilteredNodes.push(n);
    //   }
    //   return [ifilteredNodes, ifilteredOutNodes];
    // }, [[], []]);
    // console.log('calc start');
    // const {newLinks, oldLinks} = this.resolveFilteredNodesLinks(filteredOutNodes);
    // console.log('calc stop');
    // console.table({
    //   'link diff': oldLinks.length - newLinks.length,
    //   'initial links': links.length,
    //   'final links': links.filter(link => !oldLinks.includes(link)).concat(newLinks).length
    // });
    // let filteredLinks = links.concat(newLinks).filter(link => !oldLinks.includes(link));
    // if (links.length - oldLinks.length + newLinks.length !== filteredLinks.length) {
    //   const r = {
    //     filtfromlinks: links.filter(value => oldLinks.includes(value)),
    //     filtfromnew: newLinks.filter(value => oldLinks.find(d => d.path === value.path))
    //   };
    //   const r2 = oldLinks.filter(value => !r.filtfromlinks.includes(value) && !r.filtfromnew.includes(value));
    //   filteredLinks = filteredLinks.filter(value => r2.find(v => v.path === value.path));
    // }
    // this.filteredSankeyData = {
    //   ...data,
    //   nodes: filteredNodes,
    //   // filter after concat newLinks and oldLinks are not mutually exclusive
    //   links: filteredLinks
    // };
  }

  toggleFiltersPanel() {
    this.filtersPanelOpened = !this.filtersPanelOpened;
  }

  getLinkDetails({source, target, description, trace, ...details}) {
    return JSON.stringify(details, null, 2);
  }

  getNodeDetails({sourceLinks, targetLinks, description, ...details}) {
    return JSON.stringify(details, null, 2);
  }

  openPanel(template, data) {
    console.log(template, data);
    this.details = {
      template, $implicit: data
    };
    this.panelOpened = true;
  }

  closePanel() {
    this.panelOpened = false;
  }

  applyFilter() {
    if (this.selectedTrace) {
      this.selectTrace(this.selectedTrace);
    } else {
      this.filteredSankeyData = this.sankeyData;
    }
  }

  linkGraph(data) {
    data.links.forEach(l => {
      l.id = uuidv4();
    });
    const r = this.selectedValueAccessor.preprocessing(data) || {};
    return Object.assign(data, r);
  }

  extractLinkValueProperties([link = {}]) {
    // extract all numeric properties //
    console.log(link);
    this.valueAccessors = Object.entries(link).reduce((o, [k, v]) => {
      if (!isNaN(v as number)) {
        o.push({
          description: k,
          preprocessing: ({links}) => {
            links.forEach(l => {
              l.value = representativePositiveNumber(l[k]);
            });
            return {links};
          }
        });
      }
      return o;
    }, []);
  }


  parseData({links, graph, nodes, ...data}) {
    this.networkTraces = graph.trace_networks;
    this.selectedTrace = this.networkTraces[0];
    this.extractLinkValueProperties(links);
    // set colors for all node types
    const nodeColorCategoryAccessor = ({schemaClass}) => schemaClass;
    const nodeCategories = new Set(nodes.map(nodeColorCategoryAccessor));
    this.nodesColorMap = createMapToColor(
      nodeCategories,
      {
        hue: () => 0,
        lightness: (i, n) => (i + 0.5) / n,
        saturation: () => 0
      }
    );
    nodes.forEach(node => {
      node.color = this.nodesColorMap.get(nodeColorCategoryAccessor(node));
    });
    return {
      ...data,
      graph,
      // link graph
      ...this.linkGraph({
        links,
        nodes,
        inNodes: graph.node_sets.updown
      })
    } as SankeyGraph;
  }

  loadFromUrl() {
    // Check if the component was loaded with a url to parse fileId
    // from
    if (this.route.snapshot.params.file_id) {
      this.object = null;
      this.currentFileId = null;

      const linkedFileId = this.route.snapshot.params.file_id;
      this.opensankey(linkedFileId);
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
  opensankey(hashId: string) {
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
    console.log($event);
    this.selectedValueAccessor = $event;
    this.selectTrace(this.selectedTrace);
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

  openNodeDetails(node) {
    this.openPanel(this.nodeDetails, node);
  }

  openLinkDetails(link) {
    this.openPanel(this.linkDetails, link);
  }

  changeLinkSize($event: any) {
    this.selectedValueAccessor = $event;
    this.selectTrace(this.selectedTrace);
  }
}
