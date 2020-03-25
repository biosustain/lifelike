import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { of } from 'rxjs';

import { DuplicateNodeEdgePair, GetReferenceTableDataResult, VisEdge } from 'app/interfaces';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { ReferenceTableControlService } from 'app/visualization/services/reference-table-control.service';

import { VisualizationService } from '../../services/visualization.service';

import { ReferenceTableComponent } from './reference-table.component';

describe('ReferenceTableComponent', () => {
    let component: ReferenceTableComponent;
    let fixture: ComponentFixture<ReferenceTableComponent>;
    let referenceTableControlService: ReferenceTableControlService;
    let visualizationService: VisualizationService;

    let mockTableData: DuplicateNodeEdgePair[];
    let mockVisEdge: VisEdge;
    let mockReferenceTableDataResult: GetReferenceTableDataResult;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                RootStoreModule,
            ],
            declarations: [ ReferenceTableComponent ],
            providers: [
                ReferenceTableControlService,
                VisualizationService,
            ],
        });
    });

    beforeEach(() => {
        // Reset mock data before every test so changes don't carry over between tests
        mockTableData = [
            {
                node: null,
                edge: null,
            }
        ];

        mockVisEdge = {
            id: 1,
            label: 'Mock Edge',
            from: null,
            to: null,
            data: null,
            arrows: null,
        };

        mockReferenceTableDataResult = {
            referenceTableRows: [
                {
                    nodeDisplayName: 'Mock Node',
                    snippetCount: 3,
                    edge: mockVisEdge,
                }
            ],
        };

        fixture = TestBed.createComponent(ReferenceTableComponent);
        referenceTableControlService = TestBed.get<ReferenceTableControlService>(ReferenceTableControlService);
        visualizationService = TestBed.get<VisualizationService>(VisualizationService);

        component = fixture.componentInstance;
        component.tooltipSelector = '#***ARANGO_USERNAME***-table';
        component.tooltipOptions = {
            placement: 'right-start',
        };

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should request reference table data when referenceTableData setter is called', () => {
        const getReferenceTableDataSpy = spyOn(referenceTableControlService, 'getReferenceTableData');
        component.referenceTableData = mockTableData;

        expect(getReferenceTableDataSpy).toHaveBeenCalledWith(mockTableData);
    });

    it('should request edge snippets when table row is clicked', async () => {
        const getAssociationsWithEdgeSpy = spyOn(component, 'getAssociationsWithEdge');
        component.referenceTableRows = mockReferenceTableDataResult.referenceTableRows;
        component.showTooltip();

        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const referenceTableRowElements = document.getElementsByClassName('reference-table-row');

            expect(referenceTableRowElements.length).toEqual(1);

            referenceTableRowElements[0].dispatchEvent(new Event('click'));
            expect(getAssociationsWithEdgeSpy).toHaveBeenCalledWith(mockVisEdge);
        });
    });

    it('should hide the tooltip when the animationend event fires', () => {
        const hideTooltipSpy = spyOn(component, 'hideTooltip');
        component.tooltip.dispatchEvent(new Event('animationend'));

        expect(hideTooltipSpy).toHaveBeenCalled();
    });

    it('should update reference table rows when referenceTableRowData$ observable emits', () => {
        const getReferenceTableDataSpy = spyOn(
            visualizationService, 'getReferenceTableData'
        ).and.returnValue(of(mockReferenceTableDataResult));
        component.referenceTableData = mockTableData;

        expect(getReferenceTableDataSpy).toHaveBeenCalledWith(mockTableData);
        // referenceTableControlService.getReferenceTableDataSource emits a value
        expect(component.referenceTableRows).toEqual(mockReferenceTableDataResult.referenceTableRows);
    });

    it('should begin tooltip fadeout when hideTooltip$ observable emits true', (() => {
        const beginReferenceTableFadeSpy = spyOn(component, 'beginReferenceTableFade');

        referenceTableControlService.hideTooltip();
        // referenceTableControlService.hideTooltipSource emits true
        expect(beginReferenceTableFadeSpy).toHaveBeenCalled();
    }));

    it('should show tooltip when hideTooltip$ observable emits false', () => {
        const showTooltipSpy = spyOn(component, 'showTooltip');

        referenceTableControlService.showTooltip();
        // referenceTableControlService.hideTooltipSource emits false
        expect(showTooltipSpy).toHaveBeenCalled();
    });

    it('should update popper when updatePopper$ observable emits', () => {
        const updatePopperSpy = spyOn(component, 'updatePopper');

        referenceTableControlService.updatePopper(0, 0);
        // referenceTableControlService.hideTooltipSource emits {x: 0, y: 0}
        expect(updatePopperSpy).toHaveBeenCalledWith(0, 0);
    });
});
