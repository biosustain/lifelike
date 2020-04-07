import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_BASE_HREF } from '@angular/common';

import { DrawingToolModule } from '../drawing-tool.module';
import { PdfViewerComponent } from './pdf-viewer.component';
import { configureTestSuite } from 'ng-bullet';

describe('PdfViewerComponent', () => {
    let component: PdfViewerComponent;
    let fixture: ComponentFixture<PdfViewerComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                DrawingToolModule
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
