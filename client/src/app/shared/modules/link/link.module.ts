import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  AbstractLinkDirective,
  LinkWithHrefDirective,
  LinkWithoutHrefDirective,
} from './directives/link.directive';

@NgModule({
  declarations: [AbstractLinkDirective, LinkWithHrefDirective, LinkWithoutHrefDirective],
  imports: [CommonModule],
  exports: [AbstractLinkDirective, LinkWithHrefDirective, LinkWithoutHrefDirective],
})
export class LinkModule {}
