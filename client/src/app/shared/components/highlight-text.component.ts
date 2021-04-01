import { Component, ElementRef, Input } from '@angular/core';
import { annotationTypesMap } from '../annotation-styles';
import {
  Hyperlink,
  Reference,
  Source,
  UniversalGraphNode,
  UniversalGraphNodeTemplate,
} from '../../drawing-tool/services/interfaces';
import Color from 'color';
import { createNodeDragImage } from '../../drawing-tool/utils/drag';
import { isCtrlOrMetaPressed } from '../utils';
import { Meta } from '../../pdf-viewer/annotation-type';
import { SEARCH_LINKS } from '../links';

@Component({
  selector: 'app-highlight-text',
  templateUrl: './highlight-text.component.html',
  styleUrls: [
    './highlight-text.component.scss',
  ],
})
export class HighlightTextComponent {
  node: Node;
  annotationColor: string;
  annotationBackgroundColor: string;
  annotationMeta: Meta;
  searchLinks: Hyperlink[];

  constructor(private readonly elementRef: ElementRef) {
  }

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

    this.annotationColor = this.getAnnotationColor();
    this.annotationBackgroundColor = this.getAnnotationBackgroundColor();
    this.annotationMeta = this.getAnnotationMeta();
    this.searchLinks = this.getSearchLinks();
  }

  get childNodes() {
    return Array.from(this.node.childNodes);
  }

  get element(): Element | undefined {
    return this.node.nodeType === Node.ELEMENT_NODE ? this.node as Element : null;
  }

  private getSearchLinks(): Hyperlink[] {
    const meta = this.annotationMeta;
    if (meta) {
      return SEARCH_LINKS.map(({domain, url}) => {
        return {
          domain,
          url: meta.links[domain.toLowerCase()] || url.replace(/%s/, encodeURIComponent(meta.allText)),
          isDatabase: false,
        };
      });
    }
  }

  private getAnnotationColor() {
    if (!this.node || this.node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const element = this.node as Element;
    if (element.tagName === 'annotation') {
      const typeId = element.getAttribute('type').toLowerCase();
      const type = annotationTypesMap.get(typeId);
      if (type != null) {
        return type.color;
      }
    }
    return null;
  }

  private getAnnotationMeta(): Meta {
    if (!this.node || this.node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const element = this.node as Element;
    const metaData = element.getAttribute('meta');
    if (metaData) {
      return JSON.parse(metaData);
    }
    return null;
  }

  private getAnnotationBackgroundColor() {
    const color = this.annotationColor;
    if (color != null) {
      const colorObj = Color(color);
      const rgb = colorObj.object();
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    } else {
      return null;
    }
  }

  dragStart(event: DragEvent) {
    if (!this.node || this.node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const element = this.node as Element;
    const rawTypeId = element.getAttribute('type');
    if (rawTypeId == null) {
      return;
    }

    const typeId = rawTypeId.toLowerCase();
    const fileId = element.getAttribute('file-id');
    const url = element.getAttribute('url');
    const doi = element.getAttribute('doi');
    const uploadUrl = element.getAttribute('upload-url');
    const metaData = element.getAttribute('meta');
    let search = [];
    let text = element.textContent;
    let hyperlink = '';

    const sources: Source[] = [];
    const references: Reference[] = [];
    const hyperlinks: Hyperlink[] = [];

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
        domain: 'External URL',
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

      if (meta.allText != null) {
        text = meta.allText;
      }
      hyperlink = meta.idHyperlink || '';
    }

    text = typeId === 'link' ? 'Link' : text;

    if (hyperlink.length) {
      let hyperlinkText = 'Annotation URL';
      try {
        hyperlinkText = new URL(hyperlink).hostname.replace(/^www\./i, '');
      } catch (e) {
      }

      hyperlinks.push({
        domain: hyperlinkText,
        url: hyperlink,
        isDatabase: false,
      });

      references.push({
        type: 'DATABASE',
        id: hyperlink,
      });
    }

    const copiedNode: UniversalGraphNodeTemplate = {
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
    };

    const dragImageNode: UniversalGraphNode = {
      ...copiedNode,
      hash: '',
      data: {
        ...copiedNode.data,
        x: 0,
        y: 0,
      },
    };

    const dataTransfer: DataTransfer = event.dataTransfer;
    createNodeDragImage(dragImageNode).addDataTransferData(dataTransfer);
    dataTransfer.setData('text/plain', text);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify(copiedNode));

    this.selectText();

    event.stopPropagation();
  }

  mouseDown(event: MouseEvent) {
    if (isCtrlOrMetaPressed(event) && this.node && this.node.nodeType === Node.ELEMENT_NODE
      && (this.node as Element).getAttribute('type')) {
      this.selectText();
      event.stopPropagation();
    }
  }

  private selectText() {
    const range = document.createRange();
    range.selectNode(this.elementRef.nativeElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

}
