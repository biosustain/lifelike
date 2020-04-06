import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { PaletteComponent } from './palette.component';

describe('PaletteComponent', () => {
    let component: PaletteComponent;
    let fixture: ComponentFixture<PaletteComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [
                PaletteComponent,
            ],
            imports: [
                RootStoreModule,
                SharedModule,
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(PaletteComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
