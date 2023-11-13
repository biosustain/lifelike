import { Component } from '@angular/core';

import { Observable } from 'rxjs';

import { MetaDataService } from 'app/shared/services/metadata.service';
import { BuildInfo } from 'app/interfaces';
import { addStatus, PipeStatus } from 'app/shared/modules/utils/pipes/add-status.pipe';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  readonly buildInfoWithStatus$: Observable<PipeStatus<BuildInfo>> = this.metadataService
    .getBuildInfo()
    .pipe(addStatus({} as BuildInfo));

  constructor(private readonly metadataService: MetaDataService) {}
}