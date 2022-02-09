import { Component, Input, Output, EventEmitter } from '@angular/core';

import { omitBy, isNil, mapValues } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Observable, iif, defer } from 'rxjs';
import { map, switchMap, first, tap } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { viewBaseToNameMapping } from 'app/sankey/constants';

import { ViewBase } from '../../../interfaces';
import { SankeyViewConfirmComponent } from '../confirm.component';
import { SankeyViewCreateComponent } from '../create/view-create.component';
import { ViewControllerService } from '../../../services/view-controller.service';

@Component({
  selector: 'app-sankey-view-dropdown',
  templateUrl: 'view-dropdown.component.html',
  styleUrls: ['./view-dropdown.component.scss']
})
export class SankeyViewDropdownComponent {
  constructor(
    readonly workspaceManager: WorkspaceManager,
    readonly viewController: ViewControllerService,
    private modalService: NgbModal,
    readonly warningController: WarningControllerService
  ) {
  }

  activeViewName$ = this.viewController.activeViewName$;
  views$ = this.viewController.views$;
  activeViewBaseName$: Observable<string> = this.viewController.activeViewBase$.pipe(
    map(activeViewBase => viewBaseToNameMapping[activeViewBase] ?? ''));

  @Input() object: FilesystemObject;
  @Output() viewDataChanged = new EventEmitter();

  viewBase = ViewBase;

  selectView(viewName) {
    return this.viewController.selectView(viewName).toPromise();
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

  openBaseView(baseViewName: ViewBase): Promise<any> {
    return this.viewController.openBaseView(baseViewName).toPromise();
  }

  saveView(): Promise<any> {
    const createDialog = this.modalService.open(
      SankeyViewCreateComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    return createDialog.result.then(({viewName}) => this.confirmCreateView(viewName).toPromise());
  }

  confirmCreateView(viewName) {
    return this.viewController.views$.pipe(
      first(),
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
      switchMap(overwrite =>
        iif(
          () => overwrite,
          this.viewController.createView(viewName),
          of(false)
        )
      )
    );
  }

  confirmDeleteView(viewName): Promise<any> {
    return this.confirm({
      header: 'Confirm delete',
      body: `Are you sure you want to delete the '${viewName}' view?`
    }).then(() => this.viewController.deleteView(viewName).toPromise());
  }
}
