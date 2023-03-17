import {
  Directive,
  HostBinding,
  InjectionToken,
  Input,
  forwardRef,
  Optional,
  Inject,
} from '@angular/core';

const PLACEHOLDER_CONTEXT = new InjectionToken<ShowPlaceholderDirective>('show_placeholders');

@Directive({
  selector: '[appHasPlaceholder]:not(button):not(input)'
})
export class HasPlaceholderDirective {
  constructor(@Inject(PLACEHOLDER_CONTEXT) public placeholderContext: ShowPlaceholderDirective) {}
  @HostBinding('class.placeholder-slot') placeholderSlotClass = true;
}

@Directive({
  selector: 'input[appHasPlaceholder],button[appHasPlaceholder]'
})
export class InteractiveInterfaceHasPlaceholderDirective {
  constructor(@Inject(PLACEHOLDER_CONTEXT) public placeholderContext: ShowPlaceholderDirective) {}
  @HostBinding('attr.disabled') get disabled() {
    return this.placeholderContext.showPlaceholders;
  }
}

@Directive({
  selector: '[appShowPlaceholders]',
  providers:  [{ provide: PLACEHOLDER_CONTEXT, useExisting: forwardRef(() => ShowPlaceholderDirective) }]
})
export class ShowPlaceholderDirective {
  @HostBinding('class.show-placeholders') @Input('appShowPlaceholders') showPlaceholders = true;
}
