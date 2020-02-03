import { NgModule } from '@angular/core';

import { SharedModule } from '../shared.module';

import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { ReferenceTableComponent } from './components/reference-table/reference-table.component';
import { VisualizationService } from './services/visualization.service';
import { VisualizationCanvasComponent } from './components/visualization-canvas/visualization-canvas.component';
import { VisualizationQuickbarComponent } from './components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationComponent } from './containers/visualization.component';

const components = [
    ContextMenuComponent,
    ReferenceTableComponent,
    VisualizationComponent,
    VisualizationCanvasComponent,
    VisualizationQuickbarComponent,
];

@NgModule({
    imports: [SharedModule],
    declarations: components,
    providers: [VisualizationService],
    exports: components,
})
export class VisualizationModule {}
