import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { ReferenceTableControlService } from './reference-table-control.service';
import { VisualizationService } from './visualization.service';

describe('ReferenceTableControlService', () => {
    let service: ReferenceTableControlService;

    configureTestSuite(() => TestBed.configureTestingModule({
        imports: [
            RootStoreModule,
            SharedModule,
        ],
        providers: [
            ReferenceTableControlService,
            VisualizationService,
        ],
    }));

    beforeEach(() => {
        // TODO: consider Angular 9?
        // see Note in docs about Testbed.get() not being type safe
        // https://angular.io/guide/testing#angular-testbed
        // Testbed.inject() is Angular 9: https://github.com/angular/angular/issues/34401
        service = TestBed.get(ReferenceTableControlService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
