import { NgModule } from '@angular/core';
import { PdfSearchBarComponent } from './pdf-search-bar/pdf-search-bar.component';
import { PdfSearchResultsComponent } from './pdf-search-results/pdf-search-results.component';
import {SharedModule} from '../shared/shared.module';



@NgModule({
  declarations: [PdfSearchBarComponent, PdfSearchResultsComponent],
  imports: [
    SharedModule
  ]
})
export class PdfSearchModule { }
