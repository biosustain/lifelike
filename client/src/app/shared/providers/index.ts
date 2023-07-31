import { GenericDataProvider } from './data-transfer-data/generic-data.provider';
import { DATA_TRANSFER_DATA_PROVIDER } from '../services/data-transfer-data.service';
import { HIGHLIGHT_TEXT_TAG_HANDLER } from '../services/highlight-text.service';
import { XMLAnnotationComponent } from './highlight-text/xml-annotation/xml-annotation.component';
import { XMLHighlightComponent } from './highlight-text/xml-highlight.component';
import { XMLSnippetComponent } from './highlight-text/xml-snippet.component';

export default [
  GenericDataProvider,
  {
    provide: DATA_TRANSFER_DATA_PROVIDER,
    useClass: GenericDataProvider,
    multi: true,
  },
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
];
