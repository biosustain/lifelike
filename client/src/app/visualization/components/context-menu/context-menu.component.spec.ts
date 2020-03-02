import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { ContextMenuComponent } from './context-menu.component';

import { ContextMenuControlService } from '../../services/context-menu-control.service';

describe('ContextMenuComponent', () => {
    let component: ContextMenuComponent;
    let fixture: ComponentFixture<ContextMenuComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [SharedModule],
            declarations: [ ContextMenuComponent ],
            providers: [ContextMenuControlService],
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ContextMenuComponent);
        component = fixture.componentInstance;
        component.selectedNodeIds = [];
        component.selectedEdgeIds = [];
        component.selectedNodeEdgeLabels = new Set<string>();

        component.tooltipSelector = '#***ARANGO_USERNAME***-menu';
        component.tooltipOptions = {
            placement: 'right-start',
        };

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
