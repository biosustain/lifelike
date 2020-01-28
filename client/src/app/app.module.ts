import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ToolbarMenuModule } from 'toolbar-menu';

import { Neo4jModule } from './upload/neo4j.module';
import { VisualizationModule } from './visualization/visualization.module';

import { RootStoreModule } from 'src/app/root-store';


@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    Neo4jModule,
    // ngrx
    RootStoreModule,
    VisualizationModule,
    ToolbarMenuModule,
  ],
  providers: [],
  exports: [
    HttpClientModule,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
