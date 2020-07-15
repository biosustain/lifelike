import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { APP_BASE_HREF } from '@angular/common';

import { DrawingToolModule } from '../drawing-tool.module';
import { PdfViewerComponent } from './pdf-viewer.component';
import { configureTestSuite } from 'ng-bullet';
import { RootStoreModule } from 'app/root-store';
import {NodeSearchModule} from '../../node-search/node-search.module';
import {PdfSearchModule} from '../../pdf-search/pdf-search.module';

describe('PdfViewerComponent', () => {
    let component: PdfViewerComponent;
    let fixture: ComponentFixture<PdfViewerComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                DrawingToolModule,
                RouterTestingModule,
                NodeSearchModule,
                PdfSearchModule,
                RootStoreModule
            ],
            providers: [
                {provide: APP_BASE_HREF, useValue : '/' }
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(PdfViewerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
