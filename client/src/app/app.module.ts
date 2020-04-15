import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { RootStoreModule } from 'app/root-store';

import { AdminModule } from 'app/admin/admin.module';
import { AuthModule } from 'app/auth/auth.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LifelikeHomeModule } from 'app/home/lifelike-home.module';
import { UserFileImportModule } from './user-file-import/user-file-import.module';
import { SearchModule } from './search/search.module';
import { SharedModule } from './shared/shared.module';
import { FileBrowserComponent } from './file-browser/file-browser.component';

import { httpInterceptorProviders } from 'app/http-interceptors/index';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BrowserModule } from '@angular/platform-browser';

@NgModule({
  declarations: [
    AppComponent,
    FileBrowserComponent,
  ],
  imports: [
    HttpClientModule,
    BrowserModule,
    BrowserAnimationsModule,
    AdminModule,
    AuthModule,
    SharedModule,
    AppRoutingModule,
    UserFileImportModule,
    LifelikeHomeModule,
    // ngrx
    RootStoreModule,
    SearchModule,
  ],
  providers: [httpInterceptorProviders],
  exports: [
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
