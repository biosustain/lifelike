import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { DrawingToolModule } from '../../drawing-tool.module';
import { PaletteComponent } from './palette.component';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import {NodeSearchModule} from '../../../node-search/node-search.module';
import {PdfSearchModule} from '../../../pdf-search/pdf-search.module';

describe('PaletteComponent', () => {
    let component: PaletteComponent;
    let fixture: ComponentFixture<PaletteComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
              DrawingToolModule,
              NodeSearchModule,
              PdfSearchModule,
              RootStoreModule
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
