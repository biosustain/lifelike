import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {PdfSearchResultsComponent} from './pdf-search-results.component';
import {PdfSearchModule} from '../pdf-search.module';
import {RootStoreModule} from '../../root-store';
import {BrowserModule} from '@angular/platform-browser';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {SearchService} from '../../search/services/search.service';

describe('PdfSearchResultsComponent', () => {
  let component: PdfSearchResultsComponent;
  let fixture: ComponentFixture<PdfSearchResultsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        PdfSearchModule,
        RootStoreModule,
        BrowserModule,
        DragDropModule,
        BrowserAnimationsModule
      ],
      providers: [
        SearchService
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PdfSearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
