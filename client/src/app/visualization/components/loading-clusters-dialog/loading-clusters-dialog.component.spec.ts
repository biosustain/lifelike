import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

import { LoadingClustersDialogComponent } from './loading-clusters-dialog.component';



describe('LoadingClustersDialogComponent', () => {
    let component: LoadingClustersDialogComponent;
    let fixture: ComponentFixture<LoadingClustersDialogComponent>;

    class MockMatDialogRef {
        close(data: any) {}
    }

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule
            ],
            declarations: [ LoadingClustersDialogComponent ],
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
        fixture = TestBed.createComponent(LoadingClustersDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
