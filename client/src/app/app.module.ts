import { NgModule } from '@angular/core';

import { RootStoreModule } from 'app/root-store';

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

@NgModule({
  declarations: [
    AppComponent,
    WorkspaceComponent,
    WorkspaceOutletComponent,
    DashboardComponent,
    KgStatisticsComponent,
  ],
  imports: [
    BrowserModule,
    AdminModule,
    AuthModule,
    SharedModule,
    AppRoutingModule,
    UserFileImportModule,
    FileBrowserModule,
    VisualizationModule,
    UserModule,
    // ngrx
    RootStoreModule,
    SearchModule,
    ChartsModule,
    DrawingToolModule,
    NgbModule,
  ],
  providers: [
    httpInterceptorProviders,
    Title,
    WorkspaceManager,
    UnloadConfirmationGuard,
  ],
  exports: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
