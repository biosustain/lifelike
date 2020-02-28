import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { ReferenceTableComponent } from './components/reference-table/reference-table.component';
import { SearchListComponent } from './components/search-list/search-list.component';
import { VisualizationService } from './services/visualization.service';
import { VisualizationCanvasComponent } from './components/visualization-canvas/visualization-canvas.component';
import { VisualizationQuickbarComponent } from './components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationSearchComponent } from './containers/visualization-search.component';
import { VisualizationComponent } from './containers/visualization.component';

const components = [
    ContextMenuComponent,
    SearchListComponent,
    ReferenceTableComponent,
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
