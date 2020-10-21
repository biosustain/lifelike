import { Component, Input } from '@angular/core';
import { annotationTypesMap } from '../annotation-styles';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';

@Component({
  selector: 'app-highlight-text',
  templateUrl: './highlight-text.component.html',
  styleUrls: [
    './highlight-text.component.scss',
  ],
})
export class HighlightTextComponent {
  node: Element;

  @Input()
  set highlight(data) {
    if (typeof data === 'string') {
      // Note: DOMParser should be safe (doesn't load external DTDs in the worst case
      // scenario of a stored XSS in a PDF that makes it through Elasticsearch and through
      // the API) but obviously don't be swinging innerHTML around
      const parser = new DOMParser();
      this.node = parser.parseFromString(data, 'application/xml').documentElement;
    } else {
      this.node = data;
    }
  }

  get childNodes() {
    return Array.from(this.node.childNodes);
  }

  get annotationColor() {
    if (this.node.tagName === 'annotation') {
      const typeId = this.node.getAttribute('type').toLowerCase();
      const type = annotationTypesMap.get(typeId);
      if (type != null) {
        return type.color;
      }
    }
    return null;
  }

  dragStarted(event: DragEvent) {
    if (!this.node) {
      return;
    }
    const rawTypeId = this.node.getAttribute('type');
    if (rawTypeId == null) {
      return;
    }

    const typeId = rawTypeId.toLowerCase();
    const fileId = this.node.getAttribute('file-id');
    const url = this.node.getAttribute('url');
    const doi = this.node.getAttribute('doi');
    const uploadUrl = this.node.getAttribute('upload-url');
    const metaData = this.node.getAttribute('meta');
    let search = [];
    let text = this.node.textContent;
    let hyperlink = '';

    const sources = [];
    const references = [];
    const hyperlinks = [];

    if (fileId != null) {
      references.push({
        type: 'PROJECT_OBJECT',
        id: fileId,
      });
    }

    if (url != null) {
      sources.push({
        domain: 'File Source',
        url,
      });
    }

    if (doi != null) {
      sources.push({
        domain: 'DOI',
        url: doi,
      });
    }

    if (uploadUrl != null) {
      sources.push({
        domain: 'Upload URL',
        url: uploadUrl,
      });
    }

    if (metaData != null) {
      const meta = JSON.parse(metaData);

      search = Object.keys(meta.links || []).map(k => {
        return {
          domain: k,
          url: meta.links[k],
        };
      });

      text = meta.allText;
      hyperlink = meta.idHyperlink || meta.primaryLink || '';
    }

    text = typeId === 'link' ? 'Link' : text;

    if (hyperlink.length) {
      hyperlinks.push({
        domain: 'Annotation URL',
        url: hyperlink,
      });

      references.push({
        type: 'DATABASE',
        url: hyperlink,
      });
    }

    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', text);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: text,
      label: typeId,
      sub_labels: [],
      data: {
        sources,
        search,
        references,
        hyperlinks,
        detail: typeId === 'link' ? text : '',
      },
      style: {
        showDetail: typeId === 'link',
      },
    } as Partial<UniversalGraphNode>));
  }
}
