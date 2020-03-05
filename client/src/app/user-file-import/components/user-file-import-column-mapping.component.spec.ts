import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
} from '@angular/core/testing';
// import { OverlayContainer } from '@angular/cdk/overlay';
import { FormBuilder, FormArray } from '@angular/forms';
import { MatSelectChange } from '@angular/material';
import { By } from '@angular/platform-browser';

import { MemoizedSelector, Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';
import { ToolbarMenuModule } from 'toolbar-menu';

import {
    UserFileImportState as userFileImportState,
    UserFileImportSelectors as selectors,
} from '../store';

import { getNodeProperties } from '../store/actions';

import { UserFileImportColumnMappingComponent } from './user-file-import-column-mapping.component';
import { SheetNameAndColumnNames, ColumnNameIndex, SheetRowPreview } from 'app/interfaces';

const chosenSheetToMap = {
    sheetName: 'sheet1',
    sheetColumnNames: [
        {colA: 0},
        {colB: 1}
    ] as ColumnNameIndex[],
    sheetPreview: [
        {colA: 'value1', colB: 'value2'},
    ] as SheetRowPreview[],
} as SheetNameAndColumnNames;
const columnsForFilePreview = ['colA', 'colB'];

// mock store
const mockDbNodeTypes = ['labelA', 'labelB'];
const mockNodeProperties = {labelA: ['propA', 'propB']};
const mockRelationshipTypes = ['IS_A'];

describe('UserFileImportColumnMappingComponent', () => {
    let component: UserFileImportColumnMappingComponent;
    let fixture: ComponentFixture<UserFileImportColumnMappingComponent>;
    let mockStore: MockStore<userFileImportState.State>;
    // let overlayContainerElement: HTMLElement;
    let fb: FormBuilder;

    let dbNodeTypesSelector: MemoizedSelector<userFileImportState.State, string[]>;
    let dbNodePropertiesSelector: MemoizedSelector<userFileImportState.State, { [key: string]: string[] }>;
    let dbRelationshipTypesSelector: MemoizedSelector<userFileImportState.State, string[]>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            providers: [
                provideMockStore(),
                // {
                //     provide: OverlayContainer, useFactory: () => {
                //     overlayContainerElement = document.createElement('div');
                //     return { getContainerElement: () => overlayContainerElement };
                // }},
            ],
            imports: [
                RootStoreModule,
                SharedModule,
                ToolbarMenuModule,
            ],
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(UserFileImportColumnMappingComponent);
        component = fixture.componentInstance;
        fb = new FormBuilder();

        component.columnDelimiterForm = fb.group({
            column: [],
            delimiter: [],
        });
        component.chosenSheetToMap = chosenSheetToMap;
        component.columnsForFilePreview = columnsForFilePreview;

        mockStore = TestBed.get(Store);

        dbNodeTypesSelector = mockStore.overrideSelector(
            selectors.selectDbLabels, mockDbNodeTypes);
        dbNodePropertiesSelector = mockStore.overrideSelector(
            selectors.selectNodeProperties, mockNodeProperties);
        dbRelationshipTypesSelector = mockStore.overrideSelector(
            selectors.selectDbRelationshipTypes, mockRelationshipTypes);

        spyOn(mockStore, 'dispatch').and.callThrough();
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeDefined();
    });

    it('should add new column mapping form row', () => {
        component.addNewColumnMappingRow();
        expect(
            (component.columnMappingForm.get('newColumnMapping') as FormArray).controls.length,
        ).toEqual(1);
    });
});
