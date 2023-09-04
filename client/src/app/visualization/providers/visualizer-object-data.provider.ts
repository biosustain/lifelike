import { Injectable } from '@angular/core';

import { URIData } from 'app/shared/providers/data-transfer-data/generic-data.provider';
import {
  DataTransferData,
  DataTransferDataProvider,
  DataTransferToken,
} from 'app/shared/services/data-transfer-data.service';
import { AppURL } from 'app/shared/utils/url';

export const VISUALIZER_URI_TOKEN = new DataTransferToken<URIData[]>('visualizer-uri-list');
export const VISUALIZER_SNIPPET_TRANSFER_TYPE = 'vnd.lifelike.transfer/visualizer-snippet';
export const VISUALIZER_URI_TOKEN_CONFIDENCE = 10;

@Injectable()
export class VisualizerDataProvider implements DataTransferDataProvider<URIData[]> {
  extract(dataTransfer: DataTransfer): DataTransferData<URIData[]>[] {
    const results: DataTransferData<URIData[]>[] = [];
    const snippetData = dataTransfer.getData(VISUALIZER_SNIPPET_TRANSFER_TYPE);

    if (snippetData !== '') {
      const jsonParsedSnippetData = JSON.parse(snippetData);
      results.push({
        token: VISUALIZER_URI_TOKEN,
        data: [
          {
            title: jsonParsedSnippetData?.title ?? '',
            uri: new AppURL(jsonParsedSnippetData?.uri ?? ''),
          },
        ],
        confidence: VISUALIZER_URI_TOKEN_CONFIDENCE,
      });
    }

    return results;
  }
}
