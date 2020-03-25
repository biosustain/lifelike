import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AngularSplitModule } from 'angular-split';

import { RootStoreModule } from 'app/root-store';

import { AdminModule } from 'app/admin/admin.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { UserFileImportModule } from './user-file-import/user-file-import.module';
import { VisualizationModule } from './visualization/visualization.module';
import { SearchModule } from './search/search.module';
import { DrawingToolModule } from './drawing-tool/drawing-tool.module';
import { SharedModule } from './shared/shared.module';
import { FileBrowserComponent } from './file-browser/file-browser.component';

@NgModule({
  declarations: [
    AppComponent,
    FileBrowserComponent,
  ],
  imports: [
    AngularSplitModule.forRoot(),
    AdminModule,
    BrowserModule,
    SharedModule,
    AppRoutingModule,
    HttpClientModule,
    UserFileImportModule,
    VisualizationModule,
    // ngrx
    RootStoreModule,
    VisualizationModule,
    SearchModule,
    DrawingToolModule
  ],
  providers: [],
  exports: [
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
