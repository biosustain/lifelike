import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { DrawingToolModule } from '../../drawing-tool.module';
import { InfoPanelComponent } from './info-panel.component';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

describe('InfoPanelComponent', () => {
    let component: InfoPanelComponent;
    let fixture: ComponentFixture<InfoPanelComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                DrawingToolModule,
                RootStoreModule
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
