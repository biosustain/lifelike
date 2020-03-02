import { TestBed, ComponentFixture } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { VisualizationQuickbarComponent } from './visualization-quickbar.component';

describe('VisualizationQuickbarComponent', () => {
    let fixture: ComponentFixture<VisualizationQuickbarComponent>;
    let instance: VisualizationQuickbarComponent;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
            ],
            declarations: [
                VisualizationQuickbarComponent,
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(VisualizationQuickbarComponent);
        instance = fixture.debugElement.componentInstance;
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });
});
