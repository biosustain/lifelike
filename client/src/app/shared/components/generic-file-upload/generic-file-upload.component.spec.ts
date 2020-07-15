import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { GenericFileUploadComponent } from './generic-file-upload.component';

describe('GenericFileUploadComponent', () => {
    let component: GenericFileUploadComponent;
    let fixture: ComponentFixture<GenericFileUploadComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ GenericFileUploadComponent ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GenericFileUploadComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
