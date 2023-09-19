import { NgModule } from '@angular/core';

import { SearchModule } from 'app/search/search.module';
import { DATA_TRANSFER_DATA_PROVIDER } from 'app/shared/services/data-transfer-data.service';
import { SharedModule } from 'app/shared/shared.module';

import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { SidenavClusterViewComponent } from './components/sidenav-cluster-view/sidenav-cluster-view.component';
import { SidenavEdgeViewComponent } from './components/sidenav-edge-view/sidenav-edge-view.component';
import { SidenavNodeViewComponent } from './components/sidenav-node-view/sidenav-node-view.component';
import { SnippetDisplayComponent } from './components/snippet-display/snippet-display.component';
import { VisualizationService } from './services/visualization.service';
import { VisualizationCanvasComponent } from './components/visualization-canvas/visualization-canvas.component';
import { VisualizationQuickbarComponent } from './components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationSettingsComponent } from './components/visualization-settings/visualization-settings.component';
import { VisualizationComponent } from './containers/visualization/visualization.component';
import { SidenavTypeViewComponent } from './components/sidenav-type-view/sidenav-type-view.component';
import { VisualizerDataProvider } from './providers/visualizer-object-data.provider';

const components = [
  ContextMenuComponent,
  SidenavClusterViewComponent,
  SidenavEdgeViewComponent,
  SidenavNodeViewComponent,
  SidenavTypeViewComponent,
  SnippetDisplayComponent,
  VisualizationComponent,
  VisualizationCanvasComponent,
  VisualizationQuickbarComponent,
  VisualizationSettingsComponent,
];

@NgModule({
  imports: [SearchModule, SharedModule],
  declarations: components,
  providers: [
    VisualizationService,
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: VisualizerDataProvider,
      multi: true,
    },
  ],
  exports: components,
  // Need to add the cluster dialog because it is dynamically loaded by type in the VisualizationComponent
})
export class VisualizationModule {}
