import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportersRefComponent } from './exporters-ref.component';

describe('ExportersRefComponent', () => {
  let component: ExportersRefComponent;
  let fixture: ComponentFixture<ExportersRefComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ExportersRefComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ExportersRefComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
