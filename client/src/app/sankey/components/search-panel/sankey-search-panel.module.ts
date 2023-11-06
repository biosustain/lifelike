import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { SharedModule } from 'app/shared/shared.module';

import { SankeySearchPanelComponent } from './search-panel.component';
import { SearchResultComponent } from './search-result/search-result.component';

@NgModule({
  declarations: [SankeySearchPanelComponent, SearchResultComponent, SearchResultComponent],
  imports: [BrowserAnimationsModule, SharedModule],
  exports: [SankeySearchPanelComponent],
})
export class SankeySearchPanelModule {}
