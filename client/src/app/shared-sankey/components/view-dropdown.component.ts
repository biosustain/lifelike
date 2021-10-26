import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

import { transform, pick, omitBy, isNil, mapValues, isObject } from 'lodash-es';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';
import { mergeDeep } from 'app/graph-viewer/utils/objects';
import { CustomisedSankeyLayoutService } from 'app/sankey-viewer/services/customised-sankey-layout.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { SankeyView, SankeyNode, SankeyLink, SankeyNodesOverwrites, SankeyLinksOverwrites, SankeyURLLoadParams } from '../interfaces';

@Component({
  selector: 'app-sankey-view-dropdown',
  templateUrl: 'view-dropdown.component.html'
})

export class SankeyViewDropdownComponent implements OnChanges {

  get views() {
    const {allData} = this.sankeyController;
    let views = allData._views;
    if (!isObject(views)) {
      views = allData._views = {};
    }
    return views;
  }

  get activeView() {
    return this.views[this.activeViewName];
  }

  constructor(
    readonly workspaceManager: WorkspaceManager,
    readonly sankeyController: SankeyControllerService
  ) {}

  get stateFragment() {
    return new URLSearchParams(
      mapValues(
        omitBy(
          {
            network_trace: this.sankeyController.state.networkTraceIdx,
            view_name: this.activeViewName
          },
          isNil
        ),
        String
      )
    ).toString();
  }

  get activeViewBase() {
    return this.sankeyController.viewBase;
  }

  get activeViewBaseName() {
    if (this.activeViewBase === 'sankey') {
      return 'Default View';
    }
    if (this.activeViewBase === 'sankey-many-to-many') {
      return 'Trace View';
    }
  }
  @Input() activeViewName: string;
  @Output() activeViewNameChange = new EventEmitter<string>();

  @Input() object: FilesystemObject;
  @Output() viewDataChanged = new EventEmitter();

  readonly nodeViewProperties: Array<keyof SankeyNode> = [
    '_layer',
    '_fixedValue',
    '_value',
    '_depth',
    '_height',
    '_x0',
    '_x1',
    '_y0',
    '_y1',
    '_order'
  ];
  readonly linkViewProperties: Array<keyof SankeyLink> = [
    '_value',
    '_multiple_values',
    '_y0',
    '_y1',
    '_circular',
    '_width',
    '_order'
  ];

  ngOnChanges({activeViewName}: SimpleChanges) {
    if (activeViewName) {
      this.setViewFromName(activeViewName.currentValue);
    }
  }

  createView() {
    const renderedData = this.sankeyController.dataToRender.value;
    return {
      state: this.sankeyController.state,
      base: this.activeViewBase,
      nodes: this.mapToPropertyObject(renderedData.nodes, this.nodeViewProperties),
      links: this.mapToPropertyObject(renderedData.links, this.linkViewProperties)
    } as SankeyView;
  }

  applyView(viewName, view) {
    if (this.activeViewBase !== view.base) {
      this.openBaseView(view.base, {
        view_name: viewName
      });
    } else {
      mergeDeep(this.sankeyController.state, view.state);
      const graph = this.sankeyController.computeData();
      graph._precomputedLayout = true;
      this.applyPropertyObject(view.nodes, graph.nodes);
      this.applyPropertyObject(view.links, graph.links);
      // @ts-ignore
      const layout = new CustomisedSankeyLayoutService();
      layout.computeNodeLinks(graph);
      this.sankeyController.dataToRender.next(graph);
    }
  }

  objectToFragment(obj) {
    return new URLSearchParams(
      mapValues(
        omitBy(
          obj,
          isNil
        ),
        String
      )
    ).toString();
  }

  mapToPropertyObject(entities: Partial<SankeyNode | SankeyLink>[], properties) {
    return transform(entities, (result, entity) => {
      result[entity._id] = pick(entity, properties);
    }, {});
  }

  applyPropertyObject(
    propertyObject: SankeyNodesOverwrites | SankeyLinksOverwrites,
    entities: Array<SankeyNode | SankeyLink>
  ) {
    // for faster lookup
    const entityById = new Map(entities.map((d, i) => [d._id, d]));
    Object.entries(propertyObject).map(([id, properties]) => {
      const entity = entityById.get(id);
      Object.assign(entity, properties);
    });
  }

  setViewFromName(viewName) {
    const view = this.views[viewName];
    if (view) {
      this.activeViewNameChange.emit(viewName);
      this.applyView(viewName, view);
    } else {
      console.warn(`View ${viewName} has not been found in file.`);
    }
  }

  openBaseView(baseView: string, params?: Partial<SankeyURLLoadParams>) {
    const {object} = this;
    return this.workspaceManager.navigateByUrl({
      url: `/projects/${object.project.name}/${baseView}/${object.hashId}#${
        this.objectToFragment({
          network_trace: this.sankeyController.state.networkTraceIdx,
          ...params
        } as SankeyURLLoadParams)
      }`
    });
  }

  saveView() {
    if (!this.sankeyController.allData._views) {
      this.sankeyController.allData._views = {};
    }
    this.sankeyController.allData._views['Custom View'] = this.createView();
    this.viewDataChanged.emit();
  }

  deleteViews() {
    delete this.sankeyController.allData._views;
    this.viewDataChanged.emit();
  }
}
