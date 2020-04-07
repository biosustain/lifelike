import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { APP_BASE_HREF } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';

import { MockComponents } from 'ng-mocks';

import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

import { DataFlowService, DragDropEventFactory, ProjectsService } from '../services';
import { DrawingToolContextMenuControlService } from '../services/drawing-tool-context-menu-control.service';

import { DrawingToolComponent } from './drawing-tool.component';
import { DrawingToolContextMenuComponent } from './drawing-tool-context-menu/drawing-tool-context-menu.component';
import { InfoPanelComponent } from './info-panel/info-panel.component';
import { PaletteComponent } from './palette/palette.component';
import { BrowserModule } from '@angular/platform-browser';
import { PdfViewerLibModule } from 'pdf-viewer-lib';

declare const viewport;

xdescribe('DrawingToolComponent', () => {
  const mockup = {
    id: 'test',
    label: '',
    description: '',
    graph: {
      edges: [],
      nodes: []
    }
  };
  let component: DrawingToolComponent;
  let fixture: ComponentFixture<DrawingToolComponent>;

  function addNode(type: string, x: number, y: number) {
    const dragDropEvent: CdkDragDrop<any[], any[]> =
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

  function addEdge(a, b) {
    const properties = {
      nodes: [
        a
      ],
      event: {
        srcEvent: {
          pageX: 100,
          pageY: 100
        }
      }
    };
    component.networkDoubleClickHandler(properties);
    properties.nodes = [b];
    component.networkClickHandler(properties);
  }

  configureTestSuite(() => {
    TestBed.configureTestingModule({
        declarations: [
            DrawingToolComponent,
            PaletteComponent,
            MockComponents(
                DrawingToolContextMenuComponent,
                InfoPanelComponent,
            ),
        ],
        imports: [
            RouterTestingModule,
            RootStoreModule,
            SharedModule,
            BrowserModule,
            DragDropModule,
            PdfViewerLibModule,
        ],
        providers: [
          DataFlowService,
          ProjectsService,
          MatSnackBar,
          DrawingToolContextMenuControlService,
          {provide: APP_BASE_HREF, useValue : '/' }
        ]
      });
  });

  beforeEach((done) => {
    viewport.set(1920, 1080);

    fixture = TestBed.createComponent(DrawingToolComponent);
    component = fixture.componentInstance;

    const dataFlow: DataFlowService = TestBed.get(DataFlowService);
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

    const nodeIds = graph.nodes.map(n => n.id);
    const nodeA = nodeIds[0];
    const nodeB = nodeIds[1];
    const nodeC = nodeIds[2];

    addEdge(nodeA, nodeB);
    addEdge(nodeB, nodeC);
    addEdge(nodeA, nodeC);

    graph = component.visjsNetworkGraph.export();

    expect(graph.edges.length).toEqual(3);
  });

  it('should be able to undo properly after 1 click to bring only two nodes', () => {
    addNode('gene', 100, -500);
    addNode('chemical', 50, -400);
    addNode('species', 150, -400);

    component.undo();

    const graph = component.visjsNetworkGraph.export();

    expect(graph.nodes.length).toEqual(2);
  });

  it('should be able to undo 6 total draw actions to have empty graph', () => {
    addNode('gene', 100, -500);
    addNode('chemical', 50, -400);
    addNode('species', 150, -400);

    let graph = component.visjsNetworkGraph.export();

    const nodeIds = graph.nodes.map(n => n.id);
    const nodeA = nodeIds[0];
    const nodeB = nodeIds[1];
    const nodeC = nodeIds[2];

    addEdge(nodeA, nodeB);
    addEdge(nodeB, nodeC);
    addEdge(nodeA, nodeC);

    for (let i = 0; i < 6; i++) { component.undo(); }

    graph = component.visjsNetworkGraph.export();

    expect(graph.edges.length).toEqual(0);
    expect(graph.nodes.length).toEqual(0);
  });

  it('should be able to have complex series of action with undo/redo mixed in and be accurate', () => {
    addNode('gene', 100, -500);
    addNode('chemical', 50, -400);
    addNode('species', 150, -400);

    component.undo();

    addNode('entity', 200, -450);
    addNode('observation', 150, -400);

    let graph = component.visjsNetworkGraph.export();

    expect(component.redoStack.length).toEqual(0);
    expect(graph.nodes.length).toEqual(4);

    // Undo to pop action into redoStack
    component.undo();
    expect(component.redoStack.length).toEqual(1);

    // Apply redo action to have same graph state as previously
    component.redo();
    graph = component.visjsNetworkGraph.export();
    expect(graph.nodes.length).toEqual(4);

  });
});
