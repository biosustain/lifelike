import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RouteBuilderComponent } from './route-builder.component';

describe('RouteBuilderComponent', () => {
  let component: RouteBuilderComponent;
  let fixture: ComponentFixture<RouteBuilderComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ RouteBuilderComponent ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
