import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingClustersDialogComponent } from './loading-clusters-dialog.component';
import { configureTestSuite } from 'ng-bullet';

describe('LoadingClustersDialogComponent', () => {
    let component: LoadingClustersDialogComponent;
    let fixture: ComponentFixture<LoadingClustersDialogComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ LoadingClustersDialogComponent ]
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
