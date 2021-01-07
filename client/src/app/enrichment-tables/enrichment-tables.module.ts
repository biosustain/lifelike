import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { EnrichmentTableCreateDialogComponent } from './components/enrichment-table-create-dialog.component';
import { EnrichmentTableEditDialogComponent } from './components/enrichment-table-edit-dialog.component';
import { EnrichmentTableOrderDialogComponent } from './components/enrichment-table-order-dialog.component';
import { EnrichmentTableViewerComponent } from './components/enrichment-table-viewer.component';
import { FileBrowserModule } from '../file-browser/file-browser.module';

@NgModule({
  declarations: [
    EnrichmentTableViewerComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
  ],
  entryComponents: [
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
  ],
  exports: [],
  providers: [],
})
export class EnrichmentTablesModule {
}
