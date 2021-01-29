import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { MockComponents } from 'ng-mocks';

import { LegendComponent } from '../legend.component';

import { VisJsNetworkComponent } from './vis-js-network.component';

describe('VisJsNetworkComponent', () => {
  let component: VisJsNetworkComponent;
  let fixture: ComponentFixture<VisJsNetworkComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [
        VisJsNetworkComponent,
        MockComponents(
          LegendComponent
        ),
      ]
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
