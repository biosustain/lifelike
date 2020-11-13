import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { VisJsNetworkComponent } from './vis-js-network.component';

describe('VisJsNetworkComponent', () => {
  let component: VisJsNetworkComponent;
  let fixture: ComponentFixture<VisJsNetworkComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ VisJsNetworkComponent ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VisJsNetworkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
