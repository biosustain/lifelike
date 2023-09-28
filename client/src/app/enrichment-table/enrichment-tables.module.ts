import { NgModule } from '@angular/core';

import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { EnrichmentTableEditDialogComponent } from './components/dialog/enrichment-table-edit-dialog.component';
import { EnrichmentTableOrderDialogComponent } from './components/dialog/enrichment-table-order-dialog.component';
import { EnrichmentTableViewerComponent } from './components/enrichment-table-viewer.component';
import { EnrichmentTableService } from './services/enrichment-table.service';
import { EnrichmentTablePreviewComponent } from './components/enrichment-table-preview.component';
import { EnrichmentTableComponent } from './components/enrichment-table.component';
import { GenericTableComponent } from './components/generic-table/generic-table.component';

const exports = [EnrichmentTablePreviewComponent];

@NgModule({
  declarations: [
    EnrichmentTableViewerComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    EnrichmentTableComponent,
    GenericTableComponent,
    ...exports,
  ],
  imports: [SharedModule, FileBrowserModule, NgbAccordionModule],
  entryComponents: [
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    EnrichmentTablePreviewComponent,
  ],
  exports,
  providers: [EnrichmentTableService],
})
export class EnrichmentTablesModule {}
