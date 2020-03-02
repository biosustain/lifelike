import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { ReferenceTableControlService } from './reference-table-control.service';
import { VisualizationService } from './visualization.service';

describe('ReferenceTableControlService', () => {
    configureTestSuite(() => TestBed.configureTestingModule({
        imports: [SharedModule],
        providers: [
            ReferenceTableControlService,
            VisualizationService,
        ],
    }));

    it('should be created', () => {
        const service: ReferenceTableControlService = TestBed.get(ReferenceTableControlService);
        expect(service).toBeTruthy();
    });
});
