import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, Subscription } from 'rxjs';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { createMapToColor, SankeyGraph } from './sankey/utils';
import { uuidv4 } from '../../shared/utils';
import * as d3Sankey from 'd3-sankey-circular';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent {


  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute
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

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openSankeySub = this.loadTask.results$.subscribe(({
                                                             result: [object, content],
                                                           }) => {

      this.sankeyData = this.parseData(content);
      this.object = object;
      this.emitModuleProperties();

      this.currentFileId = object.hashId;
      this.ready = true;
    });

    this.loadFromUrl();
  }

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

  paths = new Set();
  nodesColorMap = new Map();

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
            path: `${tl.path} => ${node.displayName} => ${sl.path}`
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
    this.filter = filter;
    const {nodes, links, ...data} = this.sankeyData;
    const [filteredNodes, filteredOutNodes] = nodes.reduce(([ifilteredNodes, ifilteredOutNodes], n) => {
      if (filter(n).hidden) {
        ifilteredOutNodes.push(n);
      } else {
        ifilteredNodes.push(n);
      }
      return [ifilteredNodes, ifilteredOutNodes];
    }, [[], []]);
    console.log('calc start');
    const {newLinks, oldLinks} = this.resolveFilteredNodesLinks(filteredOutNodes);
    console.log('calc stop');
    console.table({
      'link diff': oldLinks.length - newLinks.length,
      'initial links': links.length,
      'final links': links.filter(link => !oldLinks.includes(link)).concat(newLinks).length
    });
    let filteredLinks = links.concat(newLinks).filter(link => !oldLinks.includes(link));
    if (links.length - oldLinks.length + newLinks.length !== filteredLinks.length) {
      const r = {
        filtfromlinks: links.filter(value => oldLinks.includes(value)),
        filtfromnew: newLinks.filter(value => oldLinks.find(d => d.path === value.path))
      };
      const r2 = oldLinks.filter(value => !r.filtfromlinks.includes(value) && !r.filtfromnew.includes(value));
      filteredLinks = filteredLinks.filter(value => r2.find(v => v.path === value.path));
    }
    this.filteredSankeyData = {
      ...data,
      nodes: filteredNodes,
      // filter after concat newLinks and oldLinks are not mutually exclusive
      links: filteredLinks
    };
  }

  toggleFiltersPanel() {
    this.filtersPanelOpened = !this.filtersPanelOpened;
  }

  parseData({links, graph, nodes, ...data}) {
    const traceIdAccessor = trace => trace.group;
    const traces = graph.trace_networks.reduce((o, n) => o.concat(n.traces), []);
    this.paths = new Set(traces.map(traceIdAccessor));
    const linksColorMap = createMapToColor(this.paths);
    traces.forEach(path => {
      const color = linksColorMap.get(traceIdAccessor(path));
      path.edges.forEach(([edgeSource, edgeTarget]) => {
        const link = links.find(({source, target, schemaClass}) => source === edgeSource && target === edgeTarget && !schemaClass);
        if (link) {
          link.schemaClass = color;
        }
      });
    });
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
    // link graph
    console.log(d3Sankey);
    links.forEach(l => l.value = 1);
    d3Sankey.sankeyCircular()
      .nodeId(n => n.id)
      .nodePadding(1)
      .nodePaddingRatio(0.5)
      .nodeAlign(d3Sankey.sankeyRight)
      .nodeWidth(10)
      ({nodes, links});
    const nodesToTraverse = nodes.reduce((o, n) => {
      if (graph.node_sets.updown.includes(n.id)) {
        n.value = 1;
        o.push(n);
      } else {
        n.value = 0.001;
      }
      return o;
    }, []);
    const traverseNodes = inodes => {
      const ilinks = inodes.reduce((o, n) => {
        return o.concat(n.sourceLinks);
      }, []);
      traverseLinks(ilinks);
    };
    const traverseLinks = ilinks => {
      const inodes = new Set();
      ilinks.forEach(link => {
        const source = link.source;
        const sourceValue = source.value;
        link.value = sourceValue / source.sourceLinks.length;
        link.target.value += link.value;
        if (!link.circular) {
          inodes.add(link.target);
        }
      });
      if (inodes.size) {
        traverseNodes([...inodes]);
      }
    };
    traverseNodes(nodesToTraverse);
    return {
      ...data,
      nodes: nodes.map(
        ({x0, x1, y0, y1, partOfCycle, circularLinkType, height, column, depth, index, value, targetLinks, sourceLinks, ...node}) => ({
          ...node,
          initialNode: Object.freeze(node)
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
          id: uuidv4(),
          initialLink: Object.freeze(link),
          value
        }))
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
}
