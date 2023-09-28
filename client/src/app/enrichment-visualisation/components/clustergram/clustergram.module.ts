import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { ClustergramComponent } from './clustergram.component';
import { LinkModule } from '../link/link.module';

const components = [ClustergramComponent];

@NgModule({
  declarations: components,
  imports: [SharedModule, LinkModule],
  exports: components,
})
export class ClustergramModule {}
