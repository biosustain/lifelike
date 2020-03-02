import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { ReferenceTableComponent } from './reference-table.component';

import { ReferenceTableControlService } from '../../services/reference-table-control.service';
import { VisualizationService } from '../../services/visualization.service';

describe('ReferenceTableComponent', () => {
    let component: ReferenceTableComponent;
    let fixture: ComponentFixture<ReferenceTableComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [SharedModule],
            declarations: [ ReferenceTableComponent ],
            providers: [
                ReferenceTableControlService,
                VisualizationService,
            ],
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ReferenceTableComponent);
        component = fixture.componentInstance;
        component.referenceTableData = [];
        component.tooltipSelector = '#***ARANGO_USERNAME***-table';
        component.tooltipOptions = {
            placement: 'right-start',
        };

        const mockElement = document.createElement('div');
        mockElement.setAttribute('id', '***ARANGO_USERNAME***-table');

        // Mock document.querySelector so we can create a valid tooltip in the component
        // (querySelector is called once in the ngOnInit of the TooltipComponent)
        document.querySelector = jasmine.createSpy('HTML Element').and.returnValue(mockElement);

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
