import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RouteSearchComponent } from './route-search.component';

describe('RouteSearchComponent', () => {
  let component: RouteSearchComponent;
  let fixture: ComponentFixture<RouteSearchComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ RouteSearchComponent ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
