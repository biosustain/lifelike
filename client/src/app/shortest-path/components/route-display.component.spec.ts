import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RouteDisplayComponent } from './route-display.component';

describe('RouteDisplayComponent', () => {
  let component: RouteDisplayComponent;
  let fixture: ComponentFixture<RouteDisplayComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ RouteDisplayComponent ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
