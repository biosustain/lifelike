import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from '../file-browser.module';
import { MessageDialog } from '../../shared/services/message-dialog.service';

import { FileUploadDialogComponent } from './file-upload-dialog.component';

describe('FileUploadDialogComponent', () => {
    let component: FileUploadDialogComponent;
    let fixture: ComponentFixture<FileUploadDialogComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            providers: [
                MessageDialog,
                NgbActiveModal,
            ],
            imports: [
                FileBrowserModule,
                RootStoreModule,
                SharedModule,
            ],
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(FileUploadDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeDefined();
    });

    it('should select Rules Based annotation method by default', () => {
        expect(component.form.get('annotationMethod').value).toEqual(component.annotationMethods[1]);
    });

    it('should update form annotation method with selected option', () => {
        component.onAnnotationMethodPick(component.annotationMethods[0], true);
        expect(component.form.get('annotationMethod').value).toEqual(component.annotationMethods[0]);
    });

    it('should mark form as invalid if no annotation method selected', () => {
        component.onAnnotationMethodPick(component.annotationMethods[0], true);
        expect(component.form.get('annotationMethod').valid).toBeTrue();

        component.onAnnotationMethodPick(component.annotationMethods[0], false);
        expect(component.form.get('annotationMethod').valid).toBeFalse();

        component.form.get('files').setValue(new File([new Blob()], 'blah'));
        component.form.get('filename').setValue('blah.pdf');
        expect(component.form.valid).toBeFalse();
    });
});
