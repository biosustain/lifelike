import { Component, EventEmitter, OnDestroy, Output, TemplateRef, ViewChild } from '@angular/core';
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
import * as d3Sankey from 'd3-sankey-circular';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GraphData } from '../../interfaces/vis-js.interface';
import * as d3 from 'd3';

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
  normalizeLinks = {value: true};

  valueGenerators = [
    {
      description: 'Fraction of fixed node value',
      disabled: () => this.selectedNodeValueAccessor === this.nodeValueGenerators[0],
      preprocessing: ({links, nodes}) => {
        links.forEach(l => l.value = 1);
        d3Sankey.sankeyCircular()
          .nodeId(n => n.id)
          .nodePadding(1)
          .nodePaddingRatio(0.5)
          .nodeAlign(d3Sankey.sankeyRight)
          .nodeWidth(10)
          ({nodes, links});
        links.forEach(l => {
          const [sv, tv] = l.multiple_values = [
            l.source.fixedValue / l.source.sourceLinks.length,
            l.target.fixedValue / l.target.targetLinks.length
          ];
          l.value = (sv + tv) / 2;
        });
        return {
          nodes: nodes.filter(n => n.sourceLinks.length + n.targetLinks.length > 0).map(
            ({x0, x1, y0, y1, partOfCycle, circularLinkType, height, column, depth, index, value, targetLinks, sourceLinks, ...node}) => ({
              ...node
            })),
          links: links.map(
            ({
               width,
               index,
               circular,
               circularLinkID,
               circularLinkType,
               circularLinkPathData,
               y0,
               y1,
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
    },
    {
      description: 'Input count',
      preprocessing: ({links, nodes, inNodes}) => {
        links.forEach(l => l.value = 1);
        d3Sankey.sankeyCircular()
          .nodeId(n => n.id)
          .nodePadding(1)
          .nodePaddingRatio(0.5)
          .nodeAlign(d3Sankey.sankeyRight)
          .nodeWidth(10)
          ({nodes, links});
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
          nodes: nodes.filter(n => n.sourceLinks.length + n.targetLinks.length > 0).map(
            ({x0, x1, y0, y1, partOfCycle, circularLinkType, height, column, depth, index, value, targetLinks, sourceLinks, ...node}) => ({
              ...node
            })),
          links: links.map(
            ({
               width,
               index,
               circular,
               circularLinkID,
               circularLinkType,
               circularLinkPathData,
               y0,
               y1,
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
  nodeValueGenerators = [
    {
      description: 'None',
      preprocessing: ({nodes}) => {
        nodes.forEach(n => {
          delete n.fixedValue;
        });
        return {nodes};
      }
    }
  ];
  valueAccessors;
  selectedValueAccessor = this.valueGenerators[1];
  nodeValueAccessors;
  selectedNodeValueAccessor = this.nodeValueGenerators[0];

  traceDetailsGraph;

  getNodeById(nodeId) {
    return (this.filteredSankeyData.nodes.find(({id}) => id === nodeId) || {}) as Node;
  }


  open(content) {
    this.modalService.open(content, {ariaLabelledBy: 'modal-basic-title', windowClass: 'fillHeightModal', size: 'xl'}).result
      .then((result) => {
      });
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
    const traceBasedLinkSplitMap = new Map();
    const allEdges = trace.traces.reduce((o, itrace, idx) => {
      const color = this.linksColorMap.get(itrace);
      const ilinks = itrace.edges.map(iidx => {
        const originLink = links[iidx];
        const link = {
          ...originLink,
          schemaClass: color,
          trace: itrace
        };
        link.id += itrace;
        let adjacentLinks = traceBasedLinkSplitMap.get(originLink);
        if (!adjacentLinks) {
          adjacentLinks = [];
          traceBasedLinkSplitMap.set(originLink, adjacentLinks);
        }
        adjacentLinks.push(link);
        return link;
      });
      return o.concat(ilinks);
    }, []);

    console.log(traceBasedLinkSplitMap);
    for (const adjacentLinkGroup of traceBasedLinkSplitMap.values()) {
      const adjacentLinkGroupLength = adjacentLinkGroup.length;
      // normalise only if multiple (skip /1)
      if (adjacentLinkGroupLength) {
        adjacentLinkGroup.forEach(l => {
          l.adjacent_divider = adjacentLinkGroupLength;
        });
      }
    }
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
    const preprocessedNodes = this.selectedNodeValueAccessor.preprocessing(data) || {};
    const preprocessedLinks = this.selectedValueAccessor.preprocessing(data) || {};
    return Object.assign(data, preprocessedLinks, preprocessedNodes);
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
              l.value = representativePositiveNumber(l[k]) / l.adjacent_divider;
            });
            return {links};
          }
        });
      } else if (Array.isArray(v) && v.length >= 2 && !isNaN(v[0]) && !isNaN(v[1])) {
        o.push({
          description: k,
          preprocessing: ({links}) => {
            links.forEach(l => {
              const [v1, v2] = l[k];
              l.multiple_values = [v1, v2].map(d => representativePositiveNumber(d) / l.adjacent_divider);
              // take max for layer calculation
              l.value = Math.max(l.multiple_values);
            });
            return {links};
          }
        });
      }
      return o;
    }, []);
  }

  extractNodeValueProperties([node = {}]) {
    // extract all numeric properties //
    console.log(node);
    this.nodeValueAccessors = Object.entries(node).reduce((o, [k, v]) => {
      if (!isNaN(v as number)) {
        o.push({
          description: k,
          preprocessing: ({nodes}) => {
            nodes.forEach(n => {
              n.fixedValue = representativePositiveNumber(n[k]);
            });
            return {nodes};
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
    this.extractNodeValueProperties(nodes);
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

  selectNodeValueAccessor($event) {
    console.log($event);
    this.selectedNodeValueAccessor = $event;
    this.selectTrace(this.selectedTrace);
  }

  updateNormalize() {
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
