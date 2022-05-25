import { Injectable, ComponentRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { get } from 'lodash-es';

import { ViewService } from 'app/file-browser/services/view.service';

import { WorkspaceManager } from '../workspace-manager';
import { ModuleAwareComponent } from '../modules';
import { getURLFromSnapshot } from '../utils/router';

@Injectable()
export class ModuleContext {
  constructor(
    readonly route: ActivatedRoute,
    readonly router: Router,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly viewService: ViewService,
  ) {
  }

  componentInstance: ModuleAwareComponent;

  register(componentInstance: ModuleAwareComponent) {
    this.componentInstance = componentInstance;
  }

  get url() {
    return this.viewService.getShareableLink(
      this.componentInstance,
      getURLFromSnapshot(this.route.snapshot, '').toString()
    ).toPromise().then(({href}) => href);
  }
}
