import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PolicyViewerComponent } from './policy-viewer.component';

describe('PolicyViewerComponent', () => {
  let component: PolicyViewerComponent;
  let fixture: ComponentFixture<PolicyViewerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PolicyViewerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PolicyViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
