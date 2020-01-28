import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ToolbarMenuModule } from 'toolbar-menu';

import { VisualizationComponent } from './visualization/visualization.component';
import { VisualizationService } from './visualization/visualization.service';

import { Neo4jModule } from './upload/neo4j.module';

import { RootStoreModule } from 'src/app/***ARANGO_USERNAME***-store';


@NgModule({
  declarations: [
    AppComponent,
    VisualizationComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    Neo4jModule,
    // ngrx
    RootStoreModule,
    ToolbarMenuModule,
  ],
  providers: [
    VisualizationService,
  ],
  exports: [
    HttpClientModule,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
