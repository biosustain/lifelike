import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ShortestPathComponent } from './containers/shortest-path.component';

const components = [
    ShortestPathComponent,
];

@NgModule({
  declarations: [...components],
  imports: [
    CommonModule
  ]
})
export class ShortestPathModule { }
