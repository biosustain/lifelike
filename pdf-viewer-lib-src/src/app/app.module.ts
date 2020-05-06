import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FlexLayoutModule } from '@angular/flex-layout';

import { DemoMaterialModule } from './material.module';
import { AppComponent } from './app.component';

import { PdfViewerLibModule } from 'pdf-viewer-lib';


@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    FormsModule,
    BrowserAnimationsModule,
    FlexLayoutModule,
    DemoMaterialModule,
    PdfViewerLibModule
  ],
  exports: [],
  providers: [],
  bootstrap: [AppComponent],
  entryComponents: []
})
export class AppModule {}
