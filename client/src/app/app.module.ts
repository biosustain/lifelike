import { ErrorHandler, NgModule } from '@angular/core';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

import { AdminModule } from 'app/admin/admin.module';
import { AuthModule } from 'app/auth/auth.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { UserFileImportModule } from './user-file-import/user-file-import.module';
import { SearchModule } from './search/search.module';
import { SharedModule } from './shared/shared.module';
import { UserModule } from 'app/users/users.module';
import { KgStatisticsComponent } from './kg-statistics.component';
import { ChartsModule } from 'ng2-charts';

import { httpInterceptorProviders } from './shared/http-interceptors';
import { BrowserModule, Title } from '@angular/platform-browser';
import { VisualizationModule } from './visualization/visualization.module';
import { DrawingToolModule } from './drawing-tool/drawing-tool.module';
import { FileBrowserModule } from './file-browser/file-browser.module';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { WorkspaceComponent } from './workspace.component';
import { WorkspaceOutletComponent } from './workspace-outlet.component';
import { WorkspaceManager } from './shared/workspace-manager';
import { UnloadConfirmationGuard } from './shared/guards/UnloadConfirmation.guard';
import { DashboardComponent } from './dashboard.component';
import { KgImportModule } from './kg-import/kg-import.module';
import { AppVersionDialogComponent } from './app-version-dialog.component';
import { FileNavigatorModule } from './file-navigator/file-navigator.module';
import { ShortestPathModule } from './shortest-path/shortest-path.module';
import { PdfViewerLibModule } from './pdf-viewer/pdf-viewer-lib.module';
import { EnrichmentTablesModule } from './enrichment-tables/enrichment-tables.module';
import { GlobalErrorHandler } from './global-error-handler';

@NgModule({
  declarations: [
    AppComponent,
    WorkspaceComponent,
    WorkspaceOutletComponent,
    AppVersionDialogComponent,
    DashboardComponent,
    KgStatisticsComponent,
  ],
  entryComponents: [
    AppVersionDialogComponent,
  ],
  imports: [
    BrowserModule,
    PdfViewerLibModule,
    AdminModule,
    AuthModule,
    SharedModule,
    AppRoutingModule,
    UserFileImportModule,
    FileBrowserModule,
    VisualizationModule,
    UserModule,
    KgImportModule,
    // ngrx
    RootStoreModule,
    SearchModule,
    ChartsModule,
    DrawingToolModule,
    NgbModule,
    FileNavigatorModule,
    ShortestPathModule,
    EnrichmentTablesModule,
  ],
  providers: [
    httpInterceptorProviders,
    Title,
    WorkspaceManager,
    UnloadConfirmationGuard,
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    }
  ],
  exports: [],
  bootstrap: [AppComponent],
})
export class AppModule {
}
