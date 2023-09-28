import { Component, Input, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TaskStatus } from '../../rxjs/background-task';
import { SharedModule } from '../../shared.module';

// TODO: not used?
@Component({
  selector: 'app-content-progress',
  templateUrl: './content-progress.component.html',
})
export class ContentProgressComponent {
  @Input() status: TaskStatus;
  @Input() loadingText: string;
  @Input() errorText: string;
}

@NgModule({
  declarations: [ContentProgressComponent],
  imports: [SharedModule],
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
