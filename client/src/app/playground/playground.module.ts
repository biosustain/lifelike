import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';
import { DynamicViewService } from 'app/shared/services/dynamic-view.service';

import { PlaygroundComponent } from './components/playground.component';
import declarations from './components';
import { PlaygroundService } from './services/playground.service';

@NgModule({
  imports: [SharedModule],
  declarations,
  exports: [PlaygroundComponent],
  providers: [PlaygroundService, DynamicViewService],
})
export class PlaygroundModule {}
