import { NgModule } from '@angular/core';

import { SharedModule } from '../shared.module';

import { VisualizationService } from './services/visualization.service';
import { VisualizationCanvasComponent } from './components/visualization-canvas.component';
import { VisualizationComponent } from './containers/visualization.component';

const components = [
    VisualizationComponent,
    VisualizationCanvasComponent,
];

@NgModule({
    imports: [SharedModule],
    declarations: components,
    providers: [VisualizationService],
    exports: components,
})
export class VisualizationModule {}
