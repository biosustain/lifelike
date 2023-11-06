import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  HasPlaceholderDirective,
  InteractiveInterfaceHasPlaceholderDirective,
  ShowPlaceholderDirective,
} from './directives/placeholder.directive';
import { WithPlaceholderComponent } from './components/with-placeholder/with-placeholder.component';

const exports = [
  WithPlaceholderComponent,
  HasPlaceholderDirective,
  InteractiveInterfaceHasPlaceholderDirective,
  ShowPlaceholderDirective,
];

@NgModule({
  imports: [CommonModule],
  declarations: [...exports],
  exports,
})
export default class PlaceholderModule {}
