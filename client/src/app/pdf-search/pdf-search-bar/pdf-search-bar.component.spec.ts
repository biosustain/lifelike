import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfSearchBarComponent } from './pdf-search-bar.component';

describe('PdfSearchBarComponent', () => {
  let component: PdfSearchBarComponent;
  let fixture: ComponentFixture<PdfSearchBarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PdfSearchBarComponent ]
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
