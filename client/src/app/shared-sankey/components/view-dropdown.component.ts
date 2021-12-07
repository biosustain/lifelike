import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

import { transform, pick, omitBy, isNil, mapValues, defer } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';
import { mergeDeep } from 'app/graph-viewer/utils/objects';
import { CustomisedSankeyLayoutService } from 'app/sankey-viewer/services/customised-sankey-layout.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import {
  SankeyView,
  SankeyNode,
  SankeyLink,
  SankeyNodesOverwrites,
  SankeyLinksOverwrites,
  SankeyURLLoadParams,
  SankeyURLLoadParam,
  SankeyApplicableView
} from '../interfaces';
import { SankeyViewConfirmComponent } from './view-confirm.component';
import { SankeyViewCreateComponent } from './view-create.component';

@Component({
  selector: 'app-sankey-view-dropdown',
  templateUrl: 'view-dropdown.component.html',
  styleUrls: ['./view-dropdown.component.scss']
})

export class SankeyViewDropdownComponent implements OnChanges {

  get views() {
    return (this.sankeyController.allData || {}).value._views;
  }

  constructor(
    readonly workspaceManager: WorkspaceManager,
    readonly sankeyController: SankeyControllerService,
    private modalService: NgbModal,
    readonly warningController: WarningControllerService
  ) {
  }

  get activeViewBase() {
    return this.sankeyController.viewBase;
  }

  get activeViewBaseName() {
    if (this.activeViewBase === 'sankey') {
      return 'Multi-Lane View';
    }
    if (this.activeViewBase === 'sankey-many-to-many') {
      return 'Single-Lane View';
    }
  }

  @Input() activeViewName: string;
  @Output() activeViewNameChange = new EventEmitter<string>();

  @Input() preselectedViewBase: string;

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
    '_order',
    '_adjacent_divider',
    '_id'
  ];


  confirm({header, body}) {
    const modal = this.modalService.open(
      SankeyViewConfirmComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    modal.componentInstance.header = header;
    modal.componentInstance.body = body;
    return modal.result;
  }

  ngOnChanges({preselectedViewBase, activeViewName}: SimpleChanges) {
    if (activeViewName || preselectedViewBase) {
      if (!isNil(this.activeViewName)) {
        defer(() => this.setViewFromName(this.activeViewName));
      } else if (!isNil(this.preselectedViewBase)) {
        this.changeViewBaseIfNeeded(this.preselectedViewBase);
      }
    }
  }

  createView(viewName) {
    const renderedData = this.sankeyController.dataToRender.value;
    const view = {
      state: this.sankeyController.state,
      base: this.activeViewBase,
      nodes: this.mapToPropertyObject(renderedData.nodes, this.nodeViewProperties),
      links: this.mapToPropertyObject(renderedData.links, this.linkViewProperties)
    } as SankeyView;

    this.sankeyController.allData.value._views[viewName] = view;
    this.sankeyController.state.viewName = viewName;
    this.viewDataChanged.emit();
  }

  changeViewBaseIfNeeded(base, params?): boolean {
    if (this.activeViewBase !== base) {
      this.openBaseView(base, params);
      return true;
    }
  }

  applyView(viewName, view: SankeyApplicableView) {
    if (!this.changeViewBaseIfNeeded(view.base, {[SankeyURLLoadParam.VIEW_NAME]: viewName})) {
      const {state = {}, nodes = {}, links = {}} = view;
      mergeDeep(this.sankeyController.state, state);
      const graph = this.sankeyController.computeData();
      graph._precomputedLayout = true;
      this.applyPropertyObject(nodes, graph.nodes);
      this.applyPropertyObject(links, graph.links);
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
    const entityById = new Map(entities.map((d, i) => [String(d._id), d]));
    Object.entries(propertyObject).map(([id, properties]) => {
      const entity = entityById.get(id);
      if (entity) {
        Object.assign(entity, properties);
      } else {
        this.warningController.warn(`No entity found for id ${id}`);
      }
    });
  }

  setViewFromName(viewName: string) {
    const view = this.views[viewName];
    if (view) {
      this.activeViewNameChange.emit(viewName);
      this.applyView(viewName, view);
    } else {
      this.warningController.warn(`View ${viewName} has not been found in file.`);
    }
  }

  openBaseView(baseView: string, params?: Partial<SankeyURLLoadParams>) {
    const {object} = this;
    return this.workspaceManager.navigateByUrl({
      url: `/projects/${object.project.name}/${baseView}/${object.hashId}#${
        this.objectToFragment({
          [SankeyURLLoadParam.NETWORK_TRACE_IDX]: this.sankeyController.state.networkTraceIdx,
          [SankeyURLLoadParam.BASE_VIEW_NAME]: baseView,
          ...params
        } as SankeyURLLoadParams)
      }`
    });
  }

  saveView() {
    if (!this.sankeyController.allData.value._views) {
      this.sankeyController.allData.value._views = {};
    }
    const createDialog = this.modalService.open(
      SankeyViewCreateComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    createDialog.result.then(({viewName}) => {
      this.confirmCreateView(viewName);
    });
  }

  confirmCreateView(viewName) {
    if (this.views[viewName]) {
      this.confirm({
        header: 'Confirm overwrite',
        body: `Saving this view as '${viewName}' will overwrite existing view. Would you like to continue?`
      }).then(() => {
        this.createView(viewName);
      });
    } else {
      this.createView(viewName);
    }
  }

  deleteView(viewName) {
    delete this.sankeyController.allData.value._views[viewName];
    if (this.activeViewName === viewName) {
      this.activeViewNameChange.emit(undefined);
    }
    this.viewDataChanged.emit();
  }

  confirmDeleteView(viewName) {
    this.confirm({
      header: 'Confirm delete',
      body: `Are you sure you want to delete the '${viewName}' view?`
    }).then(() => {
      this.deleteView(viewName);
    });
  }
}
