import { Component } from '@angular/core';
import { Observable } from 'rxjs';

import { MetaDataService } from 'app/shared/services/metadata.service';
import { BuildInfo } from 'app/interfaces';

@Component({
  selector: 'app-lifelike-homepage',
  templateUrl: './lifelike-home.component.html',
})
export class LifelikeHomePageComponent {
  readonly buildInfo$: Observable<BuildInfo>;

  constructor(private readonly metadataService: MetaDataService) {
    this.buildInfo$ = this.metadataService.getBuildInfo();
  }
}
