import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { HIGHLIGHT_TEXT_TAG_HANDLER } from './services/highlight-text.service';
import { XMLAnnotationComponent } from './components/xml-annotation/xml-annotation.component';
import { XMLHighlightComponent } from './components/xml-highlight.component';
import { XMLSnippetComponent } from './components/xml-snippet.component';
import { InnerXMLDirective } from './directives/innerXML.directive';
import UtilsModule from '../utils';

@NgModule({
  imports: [UtilsModule, CommonModule, NgbModule],
  declarations: [
    XMLAnnotationComponent,
    XMLHighlightComponent,
    XMLSnippetComponent,
    InnerXMLDirective,
  ],
  providers: [
    {
      provide: HIGHLIGHT_TEXT_TAG_HANDLER,
      useValue: {
        tag: 'annotation',
        component: XMLAnnotationComponent,
        attributes: ['type', 'meta'],
      },
      multi: true,
    },
    {
      provide: HIGHLIGHT_TEXT_TAG_HANDLER,
      useValue: {
        tag: 'highlight',
        component: XMLHighlightComponent,
        attributes: [],
      },
      multi: true,
    },
    {
      provide: HIGHLIGHT_TEXT_TAG_HANDLER,
      useValue: {
        tag: 'snippet',
        component: XMLSnippetComponent,
        attributes: [],
      },
      multi: true,
    },
  ],
  exports: [InnerXMLDirective],
})
export default class HighlightTextModule {}