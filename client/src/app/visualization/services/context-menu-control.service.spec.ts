import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ContextMenuControlService } from './context-menu-control.service';

describe('ContextMenuControlService', () => {
    configureTestSuite(() => TestBed.configureTestingModule({
        providers: [ContextMenuControlService],
    }));

    it('should be created', () => {
        const service: ContextMenuControlService = TestBed.get(ContextMenuControlService);
        expect(service).toBeTruthy();
    });
});
