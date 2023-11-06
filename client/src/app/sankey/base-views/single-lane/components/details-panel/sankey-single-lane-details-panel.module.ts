import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { SankeyDetailsPanelModule } from 'app/sankey/abstract/entity-details/sankey-details-panel.module';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { SankeySingleLaneDetailsPanelComponent } from './details-panel.component';
import { SankeySingleLaneLinkDetailsComponent } from './link-details.component';

@NgModule({
  declarations: [SankeySingleLaneDetailsPanelComponent, SankeySingleLaneLinkDetailsComponent],
  imports: [
    SankeyDetailsPanelModule,
    MatSnackBarModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forChild([]),
  ],
  exports: [SankeySingleLaneDetailsPanelComponent],
})
export class SankeySingleLaneDetailsPanelModule {}
