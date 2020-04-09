import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { CopyPasteMapsService } from './copy-paste-maps.service';

describe('CopyPasteMapsService', () => {
    configureTestSuite(() => {
        TestBed.configureTestingModule({
            providers: [
                CopyPasteMapsService,
            ],
        });
    });

    it('should be created', () => {
        const service: CopyPasteMapsService = TestBed.get(CopyPasteMapsService);
        expect(service).toBeTruthy();
    });
});
