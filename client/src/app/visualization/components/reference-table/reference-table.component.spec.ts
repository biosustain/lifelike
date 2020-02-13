import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferenceTableComponent } from './reference-table.component';

describe('ReferenceTableComponent', () => {
  let component: ReferenceTableComponent;
  let fixture: ComponentFixture<ReferenceTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ReferenceTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ReferenceTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
