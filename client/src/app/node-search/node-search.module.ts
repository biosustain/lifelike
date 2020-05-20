import {NgModule} from '@angular/core';
import {SharedModule} from '../shared/shared.module';
import {NodeSearchBarComponent} from './node-search-bar/node-search-bar.component';
import {NodeResultListComponent} from './node-result-list/node-result-list.component';
import {NodeSearchComponent} from './containers/node-search.component';


@NgModule({
  declarations: [
    NodeSearchBarComponent,
    NodeResultListComponent,
    NodeSearchComponent
  ],
  imports: [
    SharedModule
  ]
})
export class NodeSearchModule {
}
