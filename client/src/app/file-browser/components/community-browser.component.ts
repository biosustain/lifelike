import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProjectSpaceService } from '../services/project-space.service';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription } from 'rxjs';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { CollectionModal } from '../../shared/utils/collection-modal';
import { MapService } from '../../drawing-tool/services';
import { PaginatedRequestOptions, ResultList, StandardRequestOptions } from '../../interfaces/shared.interface';
import { PublicMap } from '../../drawing-tool/services/map.service';
import { ActivatedRoute, Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-community-browser',
  templateUrl: './community-browser.component.html',
})
export class CommunityBrowserComponent implements OnInit, OnDestroy {
  private readonly defaultLocator: StandardRequestOptions = {
    limit: 100,
    page: 1,
    sort: '+label,-dateModified',
  };
  public readonly loadTask: BackgroundTask<PaginatedRequestOptions, ResultList<PublicMap>> = new BackgroundTask(
    (locator: PaginatedRequestOptions) => this.mapService.getCommunityMaps(locator),
  );

  public locator: StandardRequestOptions = {
    ...this.defaultLocator,
  };

  public readonly filterForm: FormGroup = new FormGroup({
    q: new FormControl(''),
    limit: new FormControl(100),
  });

  public collectionSize = 0;
  public readonly results = new CollectionModal<PublicMap>([], {
    multipleSelection: true,
  });

  private routerParamSubscription: Subscription;
  private loadTaskSubscription: Subscription;

  constructor(private readonly projectSpaceService: ProjectSpaceService,
              private readonly mapService: MapService,
              private readonly workspaceManager: WorkspaceManager,
              private readonly progressDialog: ProgressDialog,
              private readonly ngbModal: NgbModal,
              private readonly route: ActivatedRoute,
              private readonly router: Router) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: maps}) => {
      this.collectionSize = maps.total;
      this.results.replace(maps.results);
    });

    this.routerParamSubscription = this.route.queryParams.pipe(
      tap((params) => {
        this.locator = {
          ...this.defaultLocator,
          ...params,
          // Cast to integer
          page: params.hasOwnProperty('page') ? parseInt(params.page, 10) : this.defaultLocator.page,
          limit: params.hasOwnProperty('limit') ? parseInt(params.limit, 10) : this.defaultLocator.limit,
        };
        this.filterForm.patchValue(this.locator);
        this.refresh();
      }),
    ).subscribe();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
    this.routerParamSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update(this.locator);
  }

  search() {
    this.workspaceManager.navigate(['/community'], {
      queryParams: {
        ...this.locator,
        ...this.filterForm.value,
      },
    });
  }

  goToPage(page: number) {
    this.workspaceManager.navigate(['/community'], {
      queryParams: {
        ...this.locator,
        page,
      },
    });
  }

  getObjectCommands(object: PublicMap): any[] {
    return ['/projects', object.project.projectName, 'maps', object.map.hash_id, 'edit'];
  }

  getObjectQueryParams() {
    if (this.router.url === this.workspaceManager.workspaceUrl) {
      return {};
    } else {
      return {
        return: `/community`,
      };
    }
  }
}
