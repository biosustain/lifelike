import { Component, Input, Output, EventEmitter } from '@angular/core';

import { omitBy, isNil, mapValues } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Observable, from, iif } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { SankeyControllerService } from 'app/sankey/services/sankey-controller.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyURLLoadParams, ViewBase } from '../../interfaces';
import { SankeyViewConfirmComponent } from '../view-confirm.component';
import { SankeyViewCreateComponent } from '../view-create/view-create.component';
import { viewBaseToNameMapping } from '../../constants';

@Component({
  selector: 'app-sankey-view-dropdown',
  templateUrl: 'view-dropdown.component.html',
  styleUrls: ['./view-dropdown.component.scss']
})
export class SankeyViewDropdownComponent {
  @Input() set activeViewName(viewName) {
    if (viewName) {
      const view = this.views$[viewName];
      if (view) {
        this._activeViewName = viewName;
        this._activeView = view;
      } else {
        this.warningController.warn(`View ${viewName} has not been found in file.`);
      }
    } else {
      this._activeView = undefined;
      this._activeViewName = undefined;
    }
  }

  constructor(
    readonly workspaceManager: WorkspaceManager,
    readonly sankeyController: SankeyControllerService,
    private modalService: NgbModal,
    readonly warningController: WarningControllerService
  ) {
    this.views$ = this.sankeyController.views$;
  }

  activeViewName$ = this.sankeyController.state$.pipe(
    map(({viewName}) => viewName)
  );

  activeView$ = this.sankeyController.views$.pipe(
    switchMap(views => this.sankeyController.state$.pipe(
      map(({viewName}) => views[viewName])
    ))
  );

  views$: Observable<{ [key: string]: object }>;

  activeViewBase$ = this.sankeyController.state$.pipe(
    map(({baseViewName}) => baseViewName)
  );

  activeViewBaseName$: Observable<string> = this.activeViewBase$.pipe(map(activeViewBase => viewBaseToNameMapping[activeViewBase] ?? ''));

  @Input() preselectedViewBase: string;
  @Input() object: FilesystemObject;
  @Output() viewDataChanged = new EventEmitter();

  private _activeViewName: string;
  private _activeView;

  viewBase = ViewBase;

  activeViewNameChange(viewName) {
    return this.sankeyController.selectView(viewName);
  }

  confirm({header, body}): Promise<any> {
    const modal = this.modalService.open(
      SankeyViewConfirmComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    modal.componentInstance.header = header;
    modal.componentInstance.body = body;
    return modal.result;
  }

  createView(viewName): Promise<any> {
    return this.sankeyController.createView(viewName).then(() => {
      this.viewDataChanged.emit();
    });
  }

  objectToFragment(obj): string {
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

  openBaseView(baseViewName: ViewBase, params?: Partial<SankeyURLLoadParams>): Promise<any> {
    return this.sankeyController.patchState({
      baseViewName
    }).toPromise();
    // const {object: {project, hashId}} = this;
    // return this.sankeyController.state$.pipe(
    //   first(),
    //   switchMap(({networkTraceIdx}) =>
    //     from(this.workspaceManager.navigateByUrl({
    //       url: `/projects/${project.name}/${baseView}/${hashId}#${
    //         this.objectToFragment({
    //           [SankeyURLLoadParam.NETWORK_TRACE_IDX]: networkTraceIdx,
    //           [SankeyURLLoadParam.BASE_VIEW_NAME]: baseView,
    //           ...params
    //         } as SankeyURLLoadParams)
    //       }`
    //     }))
    //   )
    // ).toPromise();
  }

  saveView(): Promise<any> {
    const createDialog = this.modalService.open(
      SankeyViewCreateComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    return createDialog.result.then(({viewName}) => this.confirmCreateView(viewName));
  }

  confirmCreateView(viewName) {
    return this.sankeyController.views$.pipe(
      switchMap(views =>
        iif(
          () => !!views[viewName],
          from(this.confirm({
            header: 'View already exists',
            body: `View ${viewName} already exists. Do you want to overwrite it?`
          })),
          of(true)
        )
      ),
      switchMap((overwrite) => (overwrite) ? from(this.createView(viewName)) : of(false))
    ).toPromise();
  }

  deleteView(viewName): Promise<any> {
    return this.sankeyController.deleteView(viewName).then(() => {
      this.viewDataChanged.emit();
    });
  }

  confirmDeleteView(viewName): void {
    this.confirm({
      header: 'Confirm delete',
      body: `Are you sure you want to delete the '${viewName}' view?`
    }).then(() => {
      this.deleteView(viewName);
    });
  }
}
