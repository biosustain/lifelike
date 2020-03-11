import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ToolbarMenuModule } from 'toolbar-menu';
import { UserFileImportModule } from './user-file-import/user-file-import.module';
import { VisualizationModule } from './visualization/visualization.module';
import { SearchModule } from './search/search.module';
import { DrawingToolModule } from './drawing-tool/drawing-tool.module';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    UserFileImportModule,
    VisualizationModule,
    // ngrx
    RootStoreModule,
    VisualizationModule,
    SearchModule,
    ToolbarMenuModule,
    DrawingToolModule
  ],
  providers: [],
  exports: [
    HttpClientModule,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
