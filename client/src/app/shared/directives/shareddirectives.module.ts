import { NgModule } from '@angular/core';

import { DebounceInputDirective } from './debounceInput';
import { DebounceClickDirective } from './debounceClick';
import { LinkWithHrefDirective, LinkWithoutHrefDirective, AbstractLinkDirective } from './link.directive';
import { FormInputDirective } from './form-input.directive';
import { AutoFocusDirective } from './auto-focus.directive';
import { ContainerBreakpointsDirective } from './container-breakpoints.directive';
import { TabSelectableDirective } from './tab-selectable.directive';
import { ContextMenuBodyDirective, ContextMenuDirective, ContextMenuItemDirective } from './context-menu.directive';
import { MouseNavigableDirective, MouseNavigableItemDirective } from './mouse-navigable.directive';
import { DataTransferDataDirective } from './data-transfer-data.directive';
import { FilesystemObjectTargetDirective } from './filesystem-object-target.directive';
import { TextTruncateToTooltipDirective } from './text-truncate-to-tooltip.directive';
import { ElementObserverDirective } from './element-observer.directive';
import { ConstrainToViewportDirective } from './constrain-to-viewport.directive';
import { CopyToClipboardDirective } from './copy-to-clipboard.directive';

const directives = [
  AbstractLinkDirective,
  DebounceClickDirective,
  DebounceInputDirective,
  LinkWithoutHrefDirective,
  LinkWithHrefDirective,
  FormInputDirective,
  AutoFocusDirective,
  ContainerBreakpointsDirective,
  TabSelectableDirective,
  ContextMenuDirective,
  ContextMenuBodyDirective,
  ContextMenuItemDirective,
  MouseNavigableDirective,
  MouseNavigableItemDirective,
  DataTransferDataDirective,
  FilesystemObjectTargetDirective,
  TextTruncateToTooltipDirective,
  CopyToClipboardDirective,
    ConstrainToViewportDirective,
  ElementObserverDirective
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
