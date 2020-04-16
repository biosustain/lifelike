import { NgModule } from '@angular/core';

import { SearchModule } from 'app/search/search.module';
import { SharedModule } from 'app/shared/shared.module';

import { AutoClusterDialogComponent } from './components/auto-cluster-dialog/auto-cluster-dialog.component';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { SidenavClusterViewComponent } from './components/sidenav-cluster-view/sidenav-cluster-view.component';
import { SidenavEdgeViewComponent } from './components/sidenav-edge-view/sidenav-edge-view.component';
import { SidenavNodeViewComponent } from './components/sidenav-node-view/sidenav-node-view.component';
import { VisualizationService } from './services/visualization.service';
import { VisualizationCanvasComponent } from './components/visualization-canvas/visualization-canvas.component';
import { VisualizationQuickbarComponent } from './components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationComponent } from './containers/visualization/visualization.component';

const components = [
    AutoClusterDialogComponent,
    ContextMenuComponent,
    SidenavClusterViewComponent,
    SidenavEdgeViewComponent,
    SidenavNodeViewComponent,
    VisualizationComponent,
    VisualizationCanvasComponent,
    VisualizationQuickbarComponent,
];

@NgModule({
    imports: [SearchModule, SharedModule],
    declarations: components,
    providers: [VisualizationService],
    exports: components,
    // Need to add the cluster dialog because it is dynamically loaded by type in the VisualizationComponent
    entryComponents: [AutoClusterDialogComponent],
})
export class VisualizationModule {}
