import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { configureTestSuite } from 'ng-bullet';

import { MemoizedSelector, Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { State } from 'app/***ARANGO_USERNAME***-store';
import { AuthSelectors } from 'app/auth/store';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from '../file-browser.module';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';

import { ObjectUploadDialogComponent } from './object-upload-dialog.component';
import { of } from 'rxjs';

describe('FileUploadDialogComponent', () => {
    let component: ObjectUploadDialogComponent;
    let fixture: ComponentFixture<ObjectUploadDialogComponent>;
    let mockStore: MockStore<State>;
    let service: PdfFilesService;
    let spy: jasmine.Spy;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            providers: [
                MessageDialog,
                NgbActiveModal,
                PdfFilesService,
                provideMockStore(),
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
        fixture = TestBed.createComponent(ObjectUploadDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        mockStore = TestBed.get(Store);

        let userAuthRoleSelector: MemoizedSelector<State, string[]>;
        userAuthRoleSelector = mockStore.overrideSelector(
            AuthSelectors.selectRoles, ['admin']);

        service = fixture.debugElement.injector.get(PdfFilesService);
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

    it('should mark form as invalid if filename is not valid', () => {
        component.form.get('filename').setValue('blah.pdf');
        spy = spyOn(service, 'validateFilename');
        spy.and.returnValue(of(false));
        expect(component.form.valid).toBeFalse();
    });

    it('should mark form as valid if filename is valid', () => {
        component.form.get('filename').setValue('blah.pdf');
        spy = spyOn(service, 'validateFilename');
        spy.and.returnValue(of(true));
        expect(component.form.valid).toBeFalse();
    });
});
