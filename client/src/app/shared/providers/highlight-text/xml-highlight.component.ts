import { Injectable, Component, HostBinding } from '@angular/core';

import { XMLTag } from '../../services/highlight-text.service';

@Component({
  selector: 'app-xml-highlight',
  template: `<ng-content></ng-content>`
})
export class XMLHighlightComponent extends XMLTag {
  @HostBinding('class.highlight-term') highlightTerm = true;
  update() {}
}
