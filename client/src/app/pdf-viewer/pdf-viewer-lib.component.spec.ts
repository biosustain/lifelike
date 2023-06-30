import { async, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

import { PdfViewerLibComponent } from './pdf-viewer-lib.component';
import { PdfViewerLibModule } from './pdf-viewer-lib.module';
import { PDFAnnotationService } from './services/pdf-annotation.service';
import { PDFSearchService } from './services/pdf-search.service';

describe('PdfViewerLibComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        BrowserAnimationsModule,
        PdfViewerLibModule,
        SharedModule,
        MatSnackBarModule,
        RootStoreModule,
      ],
      providers: [
        PDFAnnotationService,
        PDFSearchService
      ]
    }).compileComponents();
  }));
  it('should create the app', async(() => {
    const fixture = TestBed.createComponent(PdfViewerLibComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  }));
  // it(`should have as title 'app'`, async(() => {
  //   const fixture = TestBed.createComponent(AppComponent);
  //   const app = fixture.debugElement.componentInstance;
  //   expect(app.title).toEqual('app');
  // }));
  // it('should render title in a h1 tag', async(() => {
  //   const fixture = TestBed.createComponent(AppComponent);
  //   fixture.detectChanges();
  //   const compiled = fixture.debugElement.nativeElement;
  //   expect(compiled.querySelector('h1').textContent).toContain('Welcome to app!');
  // }));
});
