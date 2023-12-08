import { Component } from '@angular/core';

import { XMLTag } from '../services/highlight-text.service';


@Component({
  selector: 'app-xml-snippet',
  template: `<ng-content></ng-content>`,
})
export class XMLSnippetComponent extends XMLTag {}
