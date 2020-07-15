import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { GeneImportConfigComponent } from './gene-import-config.component';

describe('GeneImportConfigComponent', () => {
    let component: GeneImportConfigComponent;
    let fixture: ComponentFixture<GeneImportConfigComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ GeneImportConfigComponent ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GeneImportConfigComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
