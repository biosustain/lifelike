import { Injectable } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { ViewService } from 'app/file-browser/services/view.service';

import { WorkspaceManager } from '../workspace-manager';
import { getURLFromSnapshot } from '../utils/router';
import { HttpURL } from '../url/url';

@Injectable()
export class ModuleContext {
  constructor(
    readonly route: ActivatedRoute,
    readonly router: Router,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly viewService: ViewService
  ) {}

  componentInstance;

  register(componentInstance) {
    this.componentInstance = componentInstance;
  }

  get appLink(): Promise<HttpURL> {
    return this.viewService.getAppLink(
      this.componentInstance,
      getURLFromSnapshot(this.route.snapshot, '').toString()
    ).toPromise();
  }

  get shareableLink() {
    return this.viewService
      .getShareableLink(
        this.componentInstance,
        getURLFromSnapshot(this.route.snapshot, '').toString()
      )
      .toPromise()
      .then(({ href }) => href);
  }
}
