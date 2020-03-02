import { TestBed, ComponentFixture } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { VisualizationService } from '../../services/visualization.service';
import { VisualizationSearchComponent } from './visualization-search.component';

describe('VisualizationSearchComponent', () => {
    let fixture: ComponentFixture<VisualizationSearchComponent>;
    let instance: VisualizationSearchComponent;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
            ],
            declarations: [
                VisualizationSearchComponent,
            ],
            providers: [VisualizationService],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(VisualizationSearchComponent);
        instance = fixture.debugElement.componentInstance;
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });
});
