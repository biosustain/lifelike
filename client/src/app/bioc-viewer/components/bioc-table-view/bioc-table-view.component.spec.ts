import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BiocTableViewComponent } from './bioc-table-view.component';

describe('BiocTableViewComponent', () => {
  let component: BiocTableViewComponent;
  let fixture: ComponentFixture<BiocTableViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BiocTableViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BiocTableViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
