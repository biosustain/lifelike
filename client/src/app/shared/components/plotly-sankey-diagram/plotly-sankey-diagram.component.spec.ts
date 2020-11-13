import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { PlotlySankeyDiagramComponent } from './plotly-sankey-diagram.component';

describe('PlotlySankeyDiagramComponent', () => {
  let component: PlotlySankeyDiagramComponent;
  let fixture: ComponentFixture<PlotlySankeyDiagramComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ PlotlySankeyDiagramComponent ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlotlySankeyDiagramComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
