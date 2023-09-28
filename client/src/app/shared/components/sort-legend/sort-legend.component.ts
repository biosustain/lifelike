import { Component, Input, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// TODO: not used?
@Component({
  selector: 'app-sort-legend',
  templateUrl: './sort-legend.component.html',
})
export class SortLegendComponent {
  @Input() order: number | undefined;
  @Input() type: 'alpha' | 'numeric' | 'amount' = 'amount';
}

@NgModule({
  declarations: [SortLegendComponent],
  imports: [CommonModule],
})
class NotUsedModule {
  /**
   * This module is not used anywhere in the codebase.
   * It is only here to make the compiler happy.
   */
  constructor() {
    throw new Error('Not reachable');
  }
}
