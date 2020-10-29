import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ShortestPathComponent } from './containers/shortest-path.component';
import { RouteSearchComponent } from './containers/route-search.component';
import { RouteComponent } from './components/route.component';
import { RouteDisplayComponent } from './components/route-display.component';

const components = [
    ShortestPathComponent,
    RouteSearchComponent,
    RouteComponent,
    RouteDisplayComponent,
];

@NgModule({
  declarations: [...components],
  imports: [
    CommonModule
  ]
})
export class ShortestPathModule { }
