import { Component } from '@angular/core';
import { Observable } from 'rxjs';

import { MetaDataService } from 'app/shared/services/metadata.service';
import { BuildInfo } from 'app/interfaces';

@Component({
    selector: 'app-lifelike-homepage',
    templateUrl: './lifelike-home.component.html',
    styleUrls: ['./lifelike-home.component.scss']
})
export class LifelikeHomePageComponent {
    buildInfo$: Observable<BuildInfo>;

    constructor(private metadataService: MetaDataService) {
        this.buildInfo$ = this.metadataService.getBuildInfo();
    }
}
