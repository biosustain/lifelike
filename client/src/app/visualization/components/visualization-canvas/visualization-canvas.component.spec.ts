import { TestBed, ComponentFixture } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { VisualizationService } from '../../services/visualization.service';
import { ContextMenuControlService } from '../../services/context-menu-control.service';
import { ReferenceTableControlService } from '../../services/reference-table-control.service';

import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { ReferenceTableComponent } from '../reference-table/reference-table.component';
import { SidenavClusterViewComponent } from '../sidenav-cluster-view/sidenav-cluster-view.component';
import { SidenavEdgeViewComponent } from '../sidenav-edge-view/sidenav-edge-view.component';
import { SidenavNodeViewComponent } from '../sidenav-node-view/sidenav-node-view.component';
import { VisualizationQuickbarComponent } from '../../components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationCanvasComponent } from '../visualization-canvas/visualization-canvas.component';


describe('VisualizationCanvasComponent', () => {
    let fixture: ComponentFixture<VisualizationCanvasComponent>;
    let instance: VisualizationCanvasComponent;

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
                VisualizationCanvasComponent,
                VisualizationQuickbarComponent,
            ],
            providers: [
                ContextMenuControlService,
                ReferenceTableControlService,
                VisualizationService,
            ],
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(VisualizationCanvasComponent);
        instance = fixture.debugElement.componentInstance;
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });
});
