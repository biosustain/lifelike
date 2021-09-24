import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { EnrichmentTableEditDialogComponent } from './components/table/dialog/enrichment-table-edit-dialog.component';
import { EnrichmentTableOrderDialogComponent } from './components/table/dialog/enrichment-table-order-dialog.component';
import { EnrichmentTableViewerComponent } from './components/table/enrichment-table-viewer.component';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { TYPE_PROVIDER } from '../file-browser/services/object-type.service';
import { EnrichmentTableTypeProvider } from './providers/enrichment-table.type-provider';
import { EnrichmentTableService } from './services/enrichment-table.service';
import { EnrichmentTablePreviewComponent } from './components/table/enrichment-table-preview.component';

@NgModule({
  declarations: [
    EnrichmentTableViewerComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    EnrichmentTablePreviewComponent,
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
  ],
  entryComponents: [
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    EnrichmentTablePreviewComponent,
  ],
  exports: [
    EnrichmentTablePreviewComponent,
  ],
  providers: [
    EnrichmentTableService, {
      provide: TYPE_PROVIDER,
      useClass: EnrichmentTableTypeProvider,
      multi: true,
    }],
})
export class EnrichmentTablesModule {
}
