import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';

import {
  assign as _assign,
  first as _first,
  unary as _unary,
  entries as _entries,
  escapeRegExp as _escapeRegExp,
  merge as _merge
} from 'lodash-es';

import { DatabaseLink, ENTITY_TYPE_MAP, EntityType } from 'app/shared/annotation-types';
import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { LINKS } from 'app/shared/links';
import { HttpURL } from 'app/shared/url';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { Annotation } from '../../annotation-type';
import { PDFAnnotationService } from '../../services/pdf-annotation.service';

@Component({
  selector: 'app-annotation-tooltip',
  templateUrl: './annotation-tooltip.component.html',
})
export class AnnotationTooltipComponent implements OnChanges {
  constructor(
    protected readonly internalSearch: InternalSearchService,
    protected readonly annotationService: PDFAnnotationService,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly router: Router
  ) {}

  @Input() private annotation!: Annotation;
  @Output() private tooltipClose = new EventEmitter<void>();
  idType: string;
  type: string;
  isCustom: boolean;
  idLink: HttpURL;
  isExcluded: boolean;
  annoId: string;
  exclusionReason: string;
  exclusionComment: string;
  idHyperlinks: { label: string; url: string }[];
  searchLinks: { label: string; url: string }[];
  internalSearchLinks: { label: string; arguments: Parameters<WorkspaceManager['navigate']> }[];

  removeCustom() {
    return this.annotationService.annotationRemoved(this.annotation.uuid);
  }

  openExclusionPanel() {
    this.tooltipClose.emit();
    const {
      meta: { id, idHyperlinks, type },
      textInDocument,
      rects,
      pageNumber,
    } = this.annotation;
    return this.annotationService.openExclusionPanel({
      id,
      idHyperlinks,
      type,
      rects,
      pageNumber,
      text: textInDocument,
    });
  }

  highlightAll() {
    this.annotationService.highlightAllAnnotations(this.annotation.meta.id);
    this.tooltipClose.emit();
  }

  removeExclusion() {
    return this.annotationService.annotationExclusionRemoved({
      type: this.annotation.meta.type,
      text: this.annotation.textInDocument,
    });
  }

  parseAnnotationId(id: string): string {
    return _first(id.match(/[^(?:NULL)]+(?!:)/));
  }

  ngOnChanges({ annotation }: SimpleChanges): void {
    if (annotation) {
      // Make meta values parsing
      const {
        id, type, idType, idHyperlinks, links, allText, isCustom, isExcluded,
      } = annotation.currentValue.meta;
      _assign(this, {id, type, idType, isCustom, isExcluded});
      this.annoId = this.parseAnnotationId(id);

      if (ENTITY_TYPE_MAP.hasOwnProperty(type)) {
        const source = ENTITY_TYPE_MAP[type] as EntityType;
        this.idLink = source.links.find(link => link.name === idType)?.url(this.annoId);
      } else {
        this.idLink = undefined;
      }

      this.idHyperlinks = idHyperlinks?.map(_unary(JSON.parse));
      this.searchLinks = _entries(LINKS).map(([domain, {label, search}]) => ({
        url: links[domain] || search(allText),
        label
      }));
      this.internalSearchLinks = [
        {
          arguments: this.internalSearch.getVisualizerArguments(allText),
          label: 'Knowledge Graph',
        },
        {
          arguments: this.internalSearch.getFileContentsArguments(allText),
          label: 'File Content',
        },
        {
          arguments: this.internalSearch.getFileContentsArguments(allText, { types: ['map'] }),
          label: 'Map Content',
        },
      ];
    }
  }

  openInternalLink([commands, extras]: Parameters<WorkspaceManager['navigate']>) {
    return this.workspaceManager.navigate(
      commands,
      _merge(extras, {
        // If tab with exact same url exist do not open new tab
        matchExistingTab: _escapeRegExp(this.router.createUrlTree(commands, extras).toString()),
        // Keep focus on current tab so subsequent clicks on the same annotation will open tabs in same panel
        keepFocus: true,
      })
    );
  }

  removeCustomAnnotation() {
    this.tooltipClose.emit();
    return this.annotationService.annotationRemoved(this.annotation.uuid);
  }
}
