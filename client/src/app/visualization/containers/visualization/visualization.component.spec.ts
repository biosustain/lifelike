import { TestBed, ComponentFixture } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { VisualizationComponent } from './visualization.component';

import { VisualizationService } from '../../services/visualization.service';
import { ContextMenuComponent } from '../../components/context-menu/context-menu.component';
import { ReferenceTableComponent } from '../../components/reference-table/reference-table.component';
import { SidenavClusterViewComponent } from '../../components/sidenav-cluster-view/sidenav-cluster-view.component';
import { SidenavEdgeViewComponent } from '../../components/sidenav-edge-view/sidenav-edge-view.component';
import { SidenavNodeViewComponent } from '../../components/sidenav-node-view/sidenav-node-view.component';
import { VisualizationCanvasComponent } from '../../components/visualization-canvas/visualization-canvas.component';
import { VisualizationQuickbarComponent } from '../../components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationSearchComponent } from '../../containers/visualization-search/visualization-search.component';

describe('VisualizationComponent', () => {
    let fixture: ComponentFixture<VisualizationComponent>;
    let instance: VisualizationComponent;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
            ],
            declarations: [
                ContextMenuComponent,
                ReferenceTableComponent,
                SidenavClusterViewComponent,
                SidenavEdgeViewComponent,
                SidenavNodeViewComponent,
                VisualizationComponent,
                VisualizationCanvasComponent,
                VisualizationQuickbarComponent,
                VisualizationSearchComponent,
            ],
            providers: [VisualizationService],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(VisualizationComponent);
        instance = fixture.debugElement.componentInstance;
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });
});
