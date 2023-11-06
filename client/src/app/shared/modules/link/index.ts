import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  AbstractLinkDirective,
  LinkWithHrefDirective,
  LinkWithoutHrefDirective,
} from './directives/link.directive';

const exports = [LinkWithHrefDirective, LinkWithoutHrefDirective];

@NgModule({
  imports: [CommonModule],
  declarations: [AbstractLinkDirective, ...exports],
  exports,
})
export default class LinkModule {}
