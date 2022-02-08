import { Component, Input, Output, EventEmitter } from '@angular/core';

import { omitBy, isNil, mapValues } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Observable, from, iif, defer } from 'rxjs';
import { map, switchMap, first, tap } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ControllerService } from 'app/sankey/services/controller.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { viewBaseToNameMapping } from 'app/sankey/constants';

import { SankeyURLLoadParams, ViewBase } from '../../../interfaces';
import { SankeyViewConfirmComponent } from '../confirm.component';
import { SankeyViewCreateComponent } from '../create/view-create.component';
import { ViewControllerService } from '../../../services/view-controller.service';

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
    readonly viewController: ViewControllerService,
    private modalService: NgbModal,
    readonly warningController: WarningControllerService
  ) {
    this.views$ = this.viewController.common.views$;
  }

  activeViewName$ = this.viewController.common.state$.pipe(
    map(({viewName}) => viewName)
  );

  activeView$ = this.viewController.common.views$.pipe(
    switchMap(views => this.viewController.common.state$.pipe(
      map(({viewName}) => views[viewName])
    ))
  );

  views$: Observable<{ [key: string]: object }>;

  activeViewBase$ = this.viewController.common.state$.pipe(
    map(({baseViewName}) => baseViewName)
  );

  activeViewBaseName$: Observable<string> = this.activeViewBase$.pipe(map(activeViewBase => viewBaseToNameMapping[activeViewBase] ?? ''));

  @Input() preselectedViewBase: string;
  @Input() object: FilesystemObject;
  @Output() viewDataChanged = new EventEmitter();

  private _activeViewName: string;
  private _activeView;

  viewBase = ViewBase;

  @Output() createView = new EventEmitter();

  @Output() deleteView = new EventEmitter();

  activeViewNameChange(viewName) {
    return this.viewController.common.selectView(viewName);
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

  // createView(viewName): Promise<any> {
  //   return this.viewController.common.createView(viewName).then(() => {
  //     this.viewDataChanged.emit();
  //   });
  // }

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
    return this.viewController.common.patchState({
      baseViewName
    }).toPromise();
    // const {object: {project, hashId}} = this;
    // return this.viewController.common.state$.pipe(
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
    return this.viewController.common.views$.pipe(
      first(),
      tap(v => console.log(v)),
      switchMap(views =>
        iif(
          () => !!views[viewName],
          defer(() => this.confirm({
            header: 'View already exists',
            body: `View ${viewName} already exists. Do you want to overwrite it?`
          })),
          of(true)
        )
      ),
      tap(v => console.log(v)),
      tap((overwrite) => (overwrite) ? this.createView.emit(viewName) : false)
    ).toPromise();
  }

  confirmDeleteView(viewName): void {
    this.confirm({
      header: 'Confirm delete',
      body: `Are you sure you want to delete the '${viewName}' view?`
    }).then(() => {
      this.deleteView.next(viewName);
    });
  }
}
