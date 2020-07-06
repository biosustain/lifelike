import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfSearchResultsComponent } from './pdf-search-results.component';

describe('PdfSearchResultsComponent', () => {
  let component: PdfSearchResultsComponent;
  let fixture: ComponentFixture<PdfSearchResultsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PdfSearchResultsComponent ]
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
