import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { DataFlowService } from 'app/drawing-tool/services';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { InfoPanelComponent } from './info-panel.component';

describe('InfoPanelComponent', () => {
    let component: InfoPanelComponent;
    let fixture: ComponentFixture<InfoPanelComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [
                InfoPanelComponent,
            ],
            imports: [
                RootStoreModule,
                SharedModule,
            ],
            providers: [
                DataFlowService,
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(InfoPanelComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
