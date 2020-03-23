import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ReferenceTableComponent } from './reference-table.component';

import { ReferenceTableControlService } from 'app/visualization/services/reference-table-control.service';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

describe('ReferenceTableComponent', () => {
    let component: ReferenceTableComponent;
    let fixture: ComponentFixture<ReferenceTableComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ReferenceTableComponent],
            imports: [
                RootStoreModule,
            ],
            providers: [ReferenceTableControlService],
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ReferenceTableComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
