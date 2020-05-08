import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { configureTestSuite } from 'ng-bullet';

import { NoResultsFromExpandDialogComponent } from './no-results-from-expand-dialog.component';

describe('NoResultsFromExpandDialogComponent', () => {
    let component: NoResultsFromExpandDialogComponent;
    let fixture: ComponentFixture<NoResultsFromExpandDialogComponent>;

    class MockMatDialogRef {
        close(data: any) {}
    }

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ NoResultsFromExpandDialogComponent ],
            providers: [
                { provide: MatDialogRef, useClass: MockMatDialogRef },
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {},
                },
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(NoResultsFromExpandDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
