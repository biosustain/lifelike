import { NgModule } from '@angular/core';
import { DebounceInputDirective } from './debounceInput';
import { DebounceClickDirective } from './debounceClick';
import { ResizableDirective } from './resizable.directive';

@NgModule({
    imports: [],
    declarations: [
        DebounceClickDirective,
        DebounceInputDirective,
        ResizableDirective
    ],
    exports: [
        DebounceClickDirective,
        DebounceInputDirective,
        ResizableDirective
    ]
})
export class SharedDirectivesModule { }
