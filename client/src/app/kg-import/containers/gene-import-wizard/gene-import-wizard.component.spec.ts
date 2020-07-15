import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { MockComponents } from 'ng-mocks';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { WorksheetPreviewComponent } from 'app/kg-import/components/worksheet-preview/worksheet-preview.component';

import { GeneImportWizardComponent } from './gene-import-wizard.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('GeneImportWizardComponent', () => {
    let component: GeneImportWizardComponent;
    let fixture: ComponentFixture<GeneImportWizardComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [
                GeneImportWizardComponent,
                MockComponents(
                    WorksheetPreviewComponent,
                ),
            ],
            imports: [
                BrowserAnimationsModule,
                RootStoreModule,
                SharedModule
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GeneImportWizardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
