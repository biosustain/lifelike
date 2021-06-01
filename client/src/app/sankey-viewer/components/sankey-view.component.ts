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

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent {
  @Output() requestClose: EventEmitter<any> = new EventEmitter();

  paramsSubscription: Subscription;
  returnUrl: string;

  loadTask: any;
  openSankeySub: Subscription;
  ready = false;
  object?: FilesystemObject;
  // Type information coming from interface sankeySource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  sankeyData: Array<Document>;
  sankeyFileLoaded = false;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  private currentFileId: any;
  filtersPanelOpened;
  filteredSankeyData;
  filter;

  resolveFilteredNodesLinks(nodes) {
    let newLinks = [];
    let oldLinks = [];
    nodes.forEach(node => {
      node.sourceLinks.forEach(sl => {
        node.targetLinks.forEach(tl => {
          const sourceNode = sl.source;
          const targetNode = tl.target;
          const newLink = {...sl};
          newLink.source = sourceNode;
          newLink.target = targetNode;
          newLink.value = (sl.value + tl.value) / 2;
          newLink.path = `${sl.path} => ${node.display_name} => ${tl.path}`;
          newLinks.push(newLink);
          const sourceIndex = sourceNode.sourceLinks.findIndex(l => l === sl);
          const targetIndex = targetNode.targetLinks.findIndex(l => l === tl);
          if (sourceIndex !== -1) {
            sourceNode.sourceLinks[sourceIndex] = newLink;
          } else {
            sourceNode.sourceLinks.push(newLink);
          }
          if (targetIndex !== -1) {
            targetNode.targetLinks[targetIndex] = newLink;
          } else {
            targetNode.targetLinks.push(newLink);
          }
        });
      });
      oldLinks = oldLinks.concat(node.sourceLinks, node.targetLinks);
    });
    return {
      newLinks,
      oldLinks
    };
  }

  changeFilter(filter = d => d) {
    this.filter = filter;
    const {nodes, links, ...data} = this.sankeyData;
    const [filteredNodes, filteredOutNodes] = nodes.reduce(([nodes, filtered], n) => {
      if (filter(n).hidden) {
        filtered.push(n);
      } else {
        nodes.push(n);
      }
      return [nodes, filtered];
    }, [[], []]);
    const {newLinks, oldLinks} = this.resolveFilteredNodesLinks(filteredOutNodes);
    this.filteredSankeyData = {
      ...data,
      nodes: filteredNodes,
      links: links.filter(link => !oldLinks.includes(link)).concat(newLinks)
    };
  };

  toggleFiltersPanel() {
    this.filtersPanelOpened = !this.filtersPanelOpened;
  }

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

  paths = new Set();
  nodesColorMap = new Map();

  parseData({links, graph, nodes, ...data}) {
    const pathIdAccessor = path => nodes.find(n => n.id === path[0]).name[0];
    this.paths = new Set(graph.up2aak1.map(pathIdAccessor));
    const linksColorMap = createMapToColor(this.paths);
    graph.up2aak1.forEach(path => {
      const color = linksColorMap.get(pathIdAccessor(path));
      path.forEach((nodeId, nodeIdx, p) => {
        const nextNodeId = p[nodeIdx + 1] || NaN;
        const link = links.find(({source, target, schemaClass}) => source === nodeId && target === nextNodeId && !schemaClass);
        if (link) {
          link.schemaClass = color;
        } else if (nextNodeId) {
          // console.warn(`Link from ${nodeId} to ${nextNodeId} does not exist.`);
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
    return {...data, nodes, links: links.map((link, i) => ({value: link.pageUp, id: i, ...link}))} as SankeyGraph;
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
