import { NgModule } from '@angular/core';
import { DebounceInputDirective } from './debounceInput';
import { DebounceClickDirective } from './debounceClick';
import { ResizableDirective } from './resizable.directive';
import { LinkWithHrefDirective, LinkWithoutHrefDirective } from './link.directive';
import { FormInputDirective } from './form-input.directive';
import { AutoFocusDirective } from './auto-focus.directive';
import { ContainerBreakpointsDirective } from './container-breakpoints.directive';
import { TabSelectableDirective } from './tab-selectable.directive';
import { ContextMenuBodyDirective, ContextMenuDirective } from './context-menu.directive';
import { MouseNavigableDirective, MouseNavigableItemDirective } from './mouse-navigable.directive';

const directives = [
  DebounceClickDirective,
  DebounceInputDirective,
  ResizableDirective,
  LinkWithoutHrefDirective,
  LinkWithHrefDirective,
  FormInputDirective,
  AutoFocusDirective,
  ContainerBreakpointsDirective,
  TabSelectableDirective,
  ContextMenuDirective,
  ContextMenuBodyDirective,
  MouseNavigableDirective,
  MouseNavigableItemDirective,
];

@NgModule({
  imports: [],
  declarations: [
    ...directives,
  ],
  exports: [
    ...directives,
  ],
})
export class SharedDirectivesModule {
}
