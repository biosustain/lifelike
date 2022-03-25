import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnotationDetailsComponent } from './annotation-details.component';

describe('AnnotationDetailsComponent', () => {
  let component: AnnotationDetailsComponent;
  let fixture: ComponentFixture<AnnotationDetailsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AnnotationDetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AnnotationDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
