import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule, MatDialogModule, MatInputModule, MatSelectModule } from '@angular/material';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';

import { TYPE_PROVIDER } from '../file-browser/services/object-type.service';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { BiocViewComponent } from './components/bioc-view.component';
import { BiocTypeProvider } from './providers/bioc-type-provider';
import { InfonsComponent } from './components/infons/infons.component';
import { AnnotatedTextComponent } from './components/annotated-text/annotated-text.component';
import { BiocTableViewComponent } from './components/bioc-table-view/bioc-table-view.component';

@NgModule({
  declarations: [
    BiocViewComponent,
    InfonsComponent,
    AnnotatedTextComponent,
    BiocTableViewComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatSidenavModule,
    MatDialogModule,
    MatChipsModule,
    MatSelectModule,
    MatInputModule,
    FlexLayoutModule,
    MatButtonModule,
    MatRadioModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forRoot([]),
  ],
  entryComponents: [],
  providers: [{
    provide: TYPE_PROVIDER,
    useClass: BiocTypeProvider,
    multi: true,
  }],
  exports: [
    BiocViewComponent,
    InfonsComponent,
    AnnotatedTextComponent,
    BiocTableViewComponent
  ],
})
export class BiocViewerLibModule {
}
