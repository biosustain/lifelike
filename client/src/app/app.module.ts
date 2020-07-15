import { NgModule } from '@angular/core';

import { RootStoreModule } from 'app/root-store';

import { AdminModule } from 'app/admin/admin.module';
import { AuthModule } from 'app/auth/auth.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LifelikeHomeModule } from 'app/home/lifelike-home.module';
import { UserFileImportModule } from './user-file-import/user-file-import.module';
import { SearchModule } from './search/search.module';
import { SharedModule } from './shared/shared.module';
import { UserModule } from 'app/users/users.module';
import { KgStatisticsComponent } from './kg-statistics/kg-statistics.component';
import { ChartsModule } from 'ng2-charts';

import { httpInterceptorProviders } from 'app/http-interceptors/index';
import { BrowserModule, Title } from '@angular/platform-browser';
import { VisualizationModule } from './visualization/visualization.module';
import { DrawingToolModule } from './drawing-tool/drawing-tool.module';
import { FileBrowserModule } from './file-browser/file-browser.module';
import {NodeSearchModule} from './node-search/node-search.module';
import {PdfSearchModule} from './pdf-search/pdf-search.module';

@NgModule({
  declarations: [
    AppComponent,
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
    LifelikeHomeModule,
    VisualizationModule,
    UserModule,
    NodeSearchModule,
    PdfSearchModule,
    // ngrx
    RootStoreModule,
    SearchModule,
    ChartsModule,
    DrawingToolModule,
  ],
  providers: [
    httpInterceptorProviders,
    Title
  ],
  exports: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
