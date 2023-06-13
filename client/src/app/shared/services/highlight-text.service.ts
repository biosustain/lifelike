import { Injectable, InjectionToken, Type } from '@angular/core';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { InternalSearchService } from './internal-search.service';
import { GenericDataProvider } from '../providers/data-transfer-data/generic-data.provider';

interface XMLTagMapping {
  tag: string;
  component: Type<XMLTag>;
  attributes: string[];
}

export const HIGHLIGHT_TEXT_TAG_HANDLER = new InjectionToken<XMLTagMapping[]>(
  'highlightTextTagHandler'
);

@Injectable()
export class HighlightTextService {
  public object: FilesystemObject;

  constructor(private readonly internalSearch: InternalSearchService) {}

  composeSearchInternalLinks(text) {
    const organism = this.object?.fallbackOrganism?.tax_id;
    return this.internalSearch.composeSearchInternalLinks(text, organism);
  }

  getSources(meta) {
    return this.object?.getGraphEntitySources(meta) ?? [];
  }

  addDataTransferData(dataTransfer) {
    const { object } = this;
    if (object) {
      GenericDataProvider.setURIs(dataTransfer, [
        {
          title: object.filename,
          uri: object.getURL(false).toAbsolute(),
        },
      ]);
    }
  }
}

export abstract class XMLTag {}
