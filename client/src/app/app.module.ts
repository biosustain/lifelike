import { NgModule } from '@angular/core';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

import { AdminModule } from 'app/admin/admin.module';
import { AuthModule } from 'app/auth/auth.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LifelikeHomeModule } from 'app/home/***ARANGO_DB_NAME***-home.module';
import { UserFileImportModule } from './user-file-import/user-file-import.module';
import { SearchModule } from './search/search.module';
import { SharedModule } from './shared/shared.module';
import { DialogConfirmDeletion, FileBrowserComponent } from './file-browser/file-browser.component';
import { UserModule } from 'app/users/users.module';
import { KgStatisticsComponent } from './kg-statistics/kg-statistics.component';
import { ChartsModule } from 'ng2-charts';

import { httpInterceptorProviders } from 'app/http-interceptors/index';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BrowserModule } from '@angular/platform-browser';
import { VisualizationModule } from './visualization/visualization.module';
import { DrawingToolModule } from './drawing-tool/drawing-tool.module';

@NgModule({
  declarations: [
    AppComponent,
    DialogConfirmDeletion,
    FileBrowserComponent,
    KgStatisticsComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AdminModule,
    AuthModule,
    SharedModule,
    AppRoutingModule,
    UserFileImportModule,
    LifelikeHomeModule,
    VisualizationModule,
    UserModule,
    // ngrx
    RootStoreModule,
    SearchModule,
    ChartsModule,
    DrawingToolModule,
  ],
  providers: [httpInterceptorProviders],
  exports: [],
  entryComponents: [
    DialogConfirmDeletion,
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
