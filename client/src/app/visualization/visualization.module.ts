import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { ReferenceTableComponent } from './components/reference-table/reference-table.component';
import { SidenavClusterViewComponent } from './components/sidenav-cluster-view/sidenav-cluster-view.component';
import { SidenavEdgeViewComponent } from './components/sidenav-edge-view/sidenav-edge-view.component';
import { SidenavNodeViewComponent } from './components/sidenav-node-view/sidenav-node-view.component';
import { VisualizationService } from './services/visualization.service';
import { VisualizationCanvasComponent } from './components/visualization-canvas/visualization-canvas.component';
import { VisualizationQuickbarComponent } from './components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationSearchComponent } from './containers/visualization-search/visualization-search.component';
import { VisualizationComponent } from './containers/visualization/visualization.component';

const components = [
    ContextMenuComponent,
    ReferenceTableComponent,
    SidenavClusterViewComponent,
    SidenavEdgeViewComponent,
    SidenavNodeViewComponent,
    VisualizationComponent,
    VisualizationCanvasComponent,
    VisualizationQuickbarComponent,
    VisualizationSearchComponent,
];

@NgModule({
    imports: [SharedModule],
    declarations: components,
    providers: [VisualizationService],
    exports: components,
})
export class VisualizationModule {}
