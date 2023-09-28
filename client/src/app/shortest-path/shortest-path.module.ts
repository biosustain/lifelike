import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { ShortestPathComponent } from './containers/shortest-path.component';
import { RouteSearchComponent } from './containers/route-search.component';
import { RouteBuilderComponent } from './components/route-builder.component';
import { RouteDisplayComponent } from './components/route-display.component';
import { PlotlySankeyDiagramComponent } from './components/plotly-sankey-diagram/plotly-sankey-diagram.component';

const exports = [ShortestPathComponent];

@NgModule({
  imports: [SharedModule],
  declarations: [
    RouteSearchComponent,
    RouteBuilderComponent,
    RouteDisplayComponent,
    PlotlySankeyDiagramComponent,
    ...exports,
  ],
  exports,
})
export class ShortestPathModule {}
