import { NgModule } from '@angular/core';
import { DebounceInputDirective } from './debounceInput';
import { DebounceClickDirective } from './debounceClick';
import { ResizableDirective } from './resizable.directive';
import { LinkWithHrefDirective, LinkWithoutHrefDirective } from './link.directive';
import { FormInputDirective } from './form-input.directive';
import { AutoFocusDirective } from './auto-focus.directive';
import { ContainerBreakpointsDirective } from './container-breakpoints.directive';
import { TabSelectableDirective } from './tab-selectable.directive';

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
