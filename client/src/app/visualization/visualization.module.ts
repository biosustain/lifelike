import { NgModule } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatToolbarModule } from '@angular/material/toolbar';

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
import { HighlightSnippetComponent } from './components/highlight-snippet/highlight-snippet.component';

const exports = [VisualizationComponent, HighlightSnippetComponent];

@NgModule({
  imports: [SearchModule, SharedModule, MatSlideToggleModule, MatExpansionModule, MatToolbarModule],
  declarations: [
    SidenavEdgeViewComponent,
    SnippetDisplayComponent,
    VisualizationQuickbarComponent,
    SidenavNodeViewComponent,
    VisualizationSettingsComponent,
    VisualizationCanvasComponent,
    SidenavTypeViewComponent,
    ContextMenuComponent,
    SidenavClusterViewComponent,
    ...exports,
  ],
  providers: [
    VisualizationService,
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: VisualizerDataProvider,
      multi: true,
    },
  ],
  exports,
  // Need to add the cluster dialog because it is dynamically loaded by type in the VisualizationComponent
})
export class VisualizationModule {}
