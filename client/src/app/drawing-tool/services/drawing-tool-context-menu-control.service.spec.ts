import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { DrawingToolContextMenuControlService } from './drawing-tool-context-menu-control.service';

describe('DrawingToolContextMenuControlService', () => {
    let service: DrawingToolContextMenuControlService;

    configureTestSuite(() => {
        TestBed.configureTestingModule(
            {providers: [DrawingToolContextMenuControlService]},
        );
    });

    beforeEach(() => {
        // TODO: consider Angular 9?
        // see Note in docs about Testbed.get() not being type safe
        // https://angular.io/guide/testing#angular-testbed
        // Testbed.inject() is Angular 9: https://github.com/angular/angular/issues/34401
        service = TestBed.get(DrawingToolContextMenuControlService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
