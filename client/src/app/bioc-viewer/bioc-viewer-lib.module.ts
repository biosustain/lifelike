import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { BiocViewComponent } from './components/bioc-view.component';
import { InfonsComponent } from './components/infons/infons.component';
import { AnnotatedTextComponent } from './components/annotated-text/annotated-text.component';
import { BiocTableViewComponent } from './components/bioc-table-view/bioc-table-view.component';

const exports = [BiocViewComponent];

@NgModule({
  imports: [
    BrowserAnimationsModule,
    MatSnackBarModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forRoot([]),
    NgbTooltipModule,
    NgbDropdownModule,
  ],
  declarations: [InfonsComponent, AnnotatedTextComponent, BiocTableViewComponent, ...exports],
  exports,
})
export class BiocViewerLibModule {}
