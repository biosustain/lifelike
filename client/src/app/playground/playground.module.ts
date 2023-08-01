import { NgModule } from '@angular/core';

import { PlaygroundComponent } from './components/playground.component';
import declarations from './components';
import { PlaygroundService } from './services/playground.service';
import { SharedModule } from '../shared/shared.module';
import { DynamicViewService } from '../shared/services/dynamic-view.service';

@NgModule({
  imports: [SharedModule],
  declarations,
  exports: [PlaygroundComponent],
  providers: [PlaygroundService, DynamicViewService],
})
export class PlaygroundModule {}
