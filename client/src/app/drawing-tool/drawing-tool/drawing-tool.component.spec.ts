import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_BASE_HREF } from '@angular/common';
import { DrawingToolComponent } from './drawing-tool.component';

import { AppModule } from '../../app.module';
import { DataFlowService, DragDropEventFactory, ContainerModel } from '../services';
import { Project } from '../services/interfaces'
import { By } from 'protractor';
import { Data } from '@angular/router';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

declare const viewport;

describe('DrawingToolComponent', () => {
  let mockup = {
    id: 'test',
    label: '',
    description: '',
    graph: {
      edges: [],
      nodes: []
    }
  }
  let component: DrawingToolComponent;
  let fixture: ComponentFixture<DrawingToolComponent>;

  let addNode = (type: string, x: number, y: number) => {
    let dragDropEvent: CdkDragDrop<any[], any[]> = 
      new DragDropEventFactory()
        .createCrossContainerEvent(
          {
            id: 'canvas',
            data: [],
            index: 0
          },
          {
            id: 'palette',
            data: [],
            index: 0 
          },
          fixture.debugElement.nativeElement.querySelector(`#${type}`) as HTMLElement
        );
    
    dragDropEvent.distance.x = x;
    dragDropEvent.distance.y = y;

    component.drop(dragDropEvent);    
  }

  let addEdge = (a, b) => {
    let properties = {
      nodes: [
        a
      ],
      event: {
        srcEvent: {
          pageX: 100,
          pageY: 100
        }
      }
    }
    component.networkDoubleClickHandler(properties);
    properties.nodes = [b];
    component.networkClickHandler(properties);
  }

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        AppModule
      ],
      providers: [
        {provide: APP_BASE_HREF, useValue : '/' }
      ]
    })
    .compileComponents();
  }));

  beforeEach((done) => {
    viewport.set(1920, 1080)

    fixture = TestBed.createComponent(DrawingToolComponent);
    component = fixture.componentInstance;

    let dataFlow: DataFlowService = TestBed.get(DataFlowService);
    dataFlow.pushProject2Canvas(mockup);

    fixture.detectChanges();
    done();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be able to draw three nodes on graph', () => {
    addNode('gene', 100, -500);
    addNode('chemical', 50, -400);
    addNode('species', 150, -400);

    let graph = component.visjsNetworkGraph.export();

    expect(graph.nodes.length).toEqual(3);

    const node_ids = graph.nodes.map(n => n['id'])
    let nodeA = node_ids[0],
        nodeB = node_ids[1],
        nodeC = node_ids[2];

    addEdge(nodeA, nodeB);
    addEdge(nodeB, nodeC);
    addEdge(nodeA, nodeC);

    graph = component.visjsNetworkGraph.export();

    expect(graph.edges.length).toEqual(3);
  });
});
