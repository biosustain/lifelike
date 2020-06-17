import {NgModule} from '@angular/core';
import {DebounceInputDirective} from './debounceInput';
import {DebounceClickDirective} from './debounceClick';
import {ResizableDirective} from './resizable.directive';
import {LinkDirective} from "./link.directive";

@NgModule({
  imports: [],
  declarations: [
    DebounceClickDirective,
    DebounceInputDirective,
    ResizableDirective,
    LinkDirective,
  ],
  exports: [
    DebounceClickDirective,
    DebounceInputDirective,
    ResizableDirective,
    LinkDirective,
  ]
})
export class SharedDirectivesModule {
}
