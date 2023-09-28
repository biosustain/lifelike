import { CdkTree, CdkTreeModule } from '@angular/cdk/tree';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TreeViewComponent } from './components/tree-view/tree-view.component';

const exports = [TreeViewComponent];

@NgModule({
  imports: [CdkTreeModule, CommonModule],
  declarations: [...exports],
  exports,
})
export default class TreeViewModule {}
