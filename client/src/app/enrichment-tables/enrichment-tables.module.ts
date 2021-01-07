import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { EnrichmentTableCreateDialogComponent } from './components/enrichment-table-create-dialog.component';
import { EnrichmentTableEditDialogComponent } from './components/enrichment-table-edit-dialog.component';
import { EnrichmentTableOrderDialogComponent } from './components/enrichment-table-order-dialog.component';
import { EnrichmentTableViewerComponent } from './components/enrichment-table-viewer.component';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { TYPE_PROVIDER } from '../file-browser/services/object-type.service';
import { EnrichmentTableTypeProvider } from './providers/enrichment-table-type-provider';

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
  providers: [{
    provide: TYPE_PROVIDER,
    useClass: EnrichmentTableTypeProvider,
    multi: true,
  }],
})
export class EnrichmentTablesModule {
}
