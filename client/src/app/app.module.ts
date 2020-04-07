import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

import { AdminModule } from 'app/admin/admin.module';
import { AuthModule } from 'app/auth/auth.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LifelikeHomeModule } from 'app/home/***ARANGO_DB_NAME***-home.module';
import { UserFileImportModule } from './user-file-import/user-file-import.module';
import { VisualizationModule } from './visualization/visualization.module';
import { SearchModule } from './search/search.module';
import { DrawingToolModule } from './drawing-tool/drawing-tool.module';
import { SharedModule } from './shared/shared.module';
import { FileBrowserComponent } from './file-browser/file-browser.component';

import { httpInterceptorProviders } from 'app/http-interceptors/index';

@NgModule({
  declarations: [
    AppComponent,
    FileBrowserComponent,
  ],
  imports: [
    AdminModule,
    AuthModule,
    BrowserModule,
    SharedModule,
    AppRoutingModule,
    HttpClientModule,
    UserFileImportModule,
    VisualizationModule,
    LifelikeHomeModule,
    // ngrx
    RootStoreModule,
    VisualizationModule,
    SearchModule,
    DrawingToolModule
  ],
  providers: [httpInterceptorProviders],
  exports: [
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
