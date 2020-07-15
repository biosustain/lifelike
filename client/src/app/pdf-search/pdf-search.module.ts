import {NgModule} from '@angular/core';
import {PdfSearchBarComponent} from './pdf-search-bar/pdf-search-bar.component';
import {PdfSearchResultsComponent} from './pdf-search-results/pdf-search-results.component';
import {SharedModule} from '../shared/shared.module';
import {PdfSearchComponent} from './containers/pdf-search.component';


@NgModule({
  declarations: [
    PdfSearchBarComponent,
    PdfSearchResultsComponent,
    PdfSearchComponent
  ],
  imports: [
    SharedModule
  ]
})
export class PdfSearchModule {
}
