import {
  Component,
  Input,
  OnChanges,
  ViewChild,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';

import { escape, uniqueId, isString, entries } from 'lodash-es';
import Color from 'color';

import { ENTITY_TYPE_MAP, EntityType } from 'app/shared/annotation-types';
import {
  Hyperlink,
  Reference,
  Source,
  UniversalGraphNode,
  UniversalGraphNodeTemplate,
} from 'app/drawing-tool/services/interfaces';
import { createNodeDragImage } from 'app/drawing-tool/utils/drag';
import { Meta } from 'app/pdf-viewer/annotation-type';

import { LINKS } from '../../../links';
import { annotationTypesMap } from '../../../annotation-styles';
import { HighlightTextService, XMLTag } from '../../../services/highlight-text.service';
import { WorkspaceManager } from '../../../workspace-manager';

@Component({
  selector: 'app-xml-annotation',
  templateUrl: './xml-annotation.component.html',
  styleUrls: ['./xml-annotation.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class XMLAnnotationComponent extends XMLTag implements OnChanges {
  parsedMeta: Meta;

  @Input() meta: string;

  @Input() type;
  @ViewChild('annotation') annotation;

  annoId: string;
  idLink: any;
  idHyperlinks: {
    label: string;
    url: string;
  }[];
  searchLinks: {
    label: string;
    url: string;
  }[];
  searchInternalLinks: {
    label: string;
    navigate: Parameters<WorkspaceManager['navigate']>;
  }[];
  backgroundColor: string;

  constructor(
    protected readonly highlightTextService: HighlightTextService,
    protected readonly workspaceManager: WorkspaceManager
  ) {
    super();
  }

  ngOnChanges(inputChange: SimpleChanges) {
    if (inputChange.meta || inputChange.type) {
      this.parsedMeta = JSON.parse(this.meta) as Meta;
      const { id, type, idType, idHyperlinks, links, allText } = this.parsedMeta;
      const annoId = id.indexOf(':') !== -1 ? id.split(':')[1] : id;
      this.annoId = annoId.indexOf('NULL') === -1 ? annoId : undefined;
      this.idLink =
        (ENTITY_TYPE_MAP[type] as EntityType)?.links.find((link) => link.name === idType)?.url +
        this.annoId;
      this.idHyperlinks = idHyperlinks?.map((link) => JSON.parse(link));
      // links should be sorted in the order that they appear in LINKS
      this.searchLinks = entries(LINKS).map(([key, link]) => ({
        url: links[key] || link.search(allText),
        label: link.label
      }));
      this.searchInternalLinks = this.highlightTextService.composeSearchInternalLinks(allText);
      this.backgroundColor = this.toAnnotationBackgroundColor(this.getAnnotationColor());
    }
  }

  get textContent() {
    return this.annotation?.nativeElement?.textContent;
  }

  dragStart(event: DragEvent) {
    const { parsedMeta } = this;
    const text = parsedMeta.type === 'Link' ? 'Link' : parsedMeta.allText ?? this.textContent;

    let search;

    const sources: Source[] = this.highlightTextService.getSources(parsedMeta);
    const references: Reference[] = [];
    const hyperlinks: Hyperlink[] = [];

    search = Object.keys(parsedMeta.links || []).map((k) => {
      return {
        domain: k,
        url: parsedMeta.links[k],
      };
    });

    const hyperlink = parsedMeta.idHyperlinks || [];

    for (const link of hyperlink) {
      const { label, url } = JSON.parse(link);
      hyperlinks.push({
        domain: label,
        url,
      });

      references.push({
        type: 'DATABASE',
        id: url,
      });
    }

    const copiedNode: UniversalGraphNodeTemplate = {
      display_name: text,
      label: parsedMeta.type.toLowerCase(),
      sub_labels: [],
      data: {
        sources,
        search,
        references,
        hyperlinks,
        detail: parsedMeta.type === 'Link' ? text : '',
      },
      style: {
        showDetail: parsedMeta.type === 'Link',
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
    this.highlightTextService.addDataTransferData(dataTransfer);

    event.stopPropagation();
  }

  private getAnnotationColor() {
    const typeId = this.type?.toLowerCase();
    const type = annotationTypesMap.get(typeId);
    if (type != null) {
      return type.color;
    } else {
      return '#efefef';
    }
  }

  private toAnnotationBackgroundColor(color) {
    const colorObj = Color(color);
    const rgb = colorObj.object();
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
  }

  navigate(event: Event, navigate: Parameters<WorkspaceManager['navigate']>) {
    this.workspaceManager.navigate(...navigate);
    event.preventDefault();
  }
}
