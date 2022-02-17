import { ComponentFactoryResolver } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';

import { PolicyViewerComponent } from './policy-viewer.component';
import { PolicyHostDirective } from '../directives/policy-host.directive';

describe('PolicyViewerComponent', () => {
  let component: PolicyViewerComponent;
  let fixture: ComponentFixture<PolicyViewerComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [ RouterTestingModule ],
      declarations: [ PolicyViewerComponent, PolicyHostDirective ],
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PolicyViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
