import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfSearchBarComponent } from './pdf-search-bar.component';
import {RootStoreModule} from '../../root-store';
import {BrowserModule} from '@angular/platform-browser';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {SearchService} from '../../search/services/search.service';
import {PdfSearchModule} from '../pdf-search.module';

describe('PdfSearchBarComponent', () => {
  let component: PdfSearchBarComponent;
  let fixture: ComponentFixture<PdfSearchBarComponent>;

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
    fixture = TestBed.createComponent(PdfSearchBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
