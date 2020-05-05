import { Component } from '@angular/core';
import { Observable } from 'rxjs';

import { MetaDataService } from 'app/shared/services/metadata.service';
import { BuildInfo } from 'app/interfaces';

@Component({
    selector: 'app-***ARANGO_DB_NAME***-homepage',
    templateUrl: './***ARANGO_DB_NAME***-home.component.html',
    styleUrls: ['./***ARANGO_DB_NAME***-home.component.scss']
})
export class LifelikeHomePageComponent {
    buildInfo$: Observable<BuildInfo>;

    constructor(private metadataService: MetaDataService) {
        this.buildInfo$ = this.metadataService.getBuildInfo();
    }
}
