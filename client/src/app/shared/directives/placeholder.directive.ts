import {
  Directive,
  forwardRef,
  HostBinding,
  Inject,
  InjectionToken,
  Input,
  Optional,
} from '@angular/core';

const PLACEHOLDER_CONTEXT = new InjectionToken<ShowPlaceholderDirective>('show_placeholders');
const warnMissingPlaceholderContext = (placeholderContext) => {
  if (!placeholderContext) {
    console.warn('Placeholder directive should be used inside a placeholder context');
  }
};

@Directive({
  selector: '[appHasPlaceholder]:not(button):not(input)',
})
export class HasPlaceholderDirective {
  constructor(
    @Inject(PLACEHOLDER_CONTEXT) @Optional() public placeholderContext: ShowPlaceholderDirective
  ) {
    warnMissingPlaceholderContext(placeholderContext);
  }

  @HostBinding('class.placeholder-slot') placeholderSlotClass = true;
}

@Directive({
  selector: 'input[appHasPlaceholder],button[appHasPlaceholder]',
})
export class InteractiveInterfaceHasPlaceholderDirective {
  constructor(
    @Inject(PLACEHOLDER_CONTEXT) @Optional() public placeholderContext: ShowPlaceholderDirective
  ) {
    warnMissingPlaceholderContext(placeholderContext);
  }

  @HostBinding('attr.disabled') get disabled() {
    return this.placeholderContext?.showPlaceholders || null;
  }
}

@Directive({
  selector: '[appShowPlaceholders]',
  providers: [
    { provide: PLACEHOLDER_CONTEXT, useExisting: forwardRef(() => ShowPlaceholderDirective) },
  ],
})
export class ShowPlaceholderDirective {
  @HostBinding('class.show-placeholders') @Input('appShowPlaceholders') showPlaceholders = true;
}
