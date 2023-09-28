import { NgModule } from '@angular/core';

import {
  HasPlaceholderDirective,
  InteractiveInterfaceHasPlaceholderDirective,
  ShowPlaceholderDirective,
} from './directives/placeholder.directive';
import { WithPlaceholderComponent } from './components/with-placeholder/with-placeholder.component';

@NgModule({
  declarations: [
    WithPlaceholderComponent,
    HasPlaceholderDirective,
    InteractiveInterfaceHasPlaceholderDirective,
    ShowPlaceholderDirective,
  ],
  exports: [
    WithPlaceholderComponent,
    HasPlaceholderDirective,
    InteractiveInterfaceHasPlaceholderDirective,
    ShowPlaceholderDirective,
  ],
})
export class PlaceholderModule {}
