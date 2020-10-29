import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ShortestPathComponent } from './shortest-path.component';

describe('ShortestPathComponent', () => {
  let component: ShortestPathComponent;
  let fixture: ComponentFixture<ShortestPathComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ ShortestPathComponent ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShortestPathComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
