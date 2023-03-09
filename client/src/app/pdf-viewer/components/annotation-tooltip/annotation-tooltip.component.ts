import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from "@angular/core";
import { UrlTree } from "@angular/router";

import { assign, first, unary } from "lodash-es";

import { SEARCH_LINKS } from "app/shared/links";
import {
  DatabaseLink,
  ENTITY_TYPE_MAP,
  EntityType,
} from "app/shared/annotation-types";
import { InternalSearchService } from "app/shared/services/internal-search.service";

import { Annotation } from "../../annotation-type";
import { PDFAnnotationService } from "../../services/pdf-annotation.service";

@Component({
  selector: "app-annotation-tooltip",
  templateUrl: "./annotation-tooltip.component.html",
})
export class AnnotationTooltipComponent implements OnChanges {
  constructor(
    protected readonly internalSearch: InternalSearchService,
    protected readonly annotationService: PDFAnnotationService
  ) {}

  @Input() private annotation!: Annotation;
  @Output() private tooltipClose = new EventEmitter<void>();
  idType: string;
  type: string;
  isCustom: boolean;
  idLink: DatabaseLink;
  isExcluded: boolean;
  annoId: string;
  exclusionReason: string;
  exclusionComment: string;
  idHyperlinks: { label: string; url: string }[];
  searchLinks: { label: string; url: string }[];
  internalSearchLinks: { label: string; url: UrlTree }[];

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
    return first(id.match(/[^(?:NULL)]+(?!:)/));
  }

  ngOnChanges({ annotation }: SimpleChanges): void {
    if (annotation) {
      // Make meta values parsing
      const {
        id,
        type,
        idType,
        idHyperlinks,
        links,
        allText,
        isCustom,
        isExcluded,
      } = annotation.currentValue.meta;
      assign(this, { id, type, idType, isCustom, isExcluded });
      this.annoId = this.parseAnnotationId(id);

      if (ENTITY_TYPE_MAP.hasOwnProperty(type)) {
        const source = ENTITY_TYPE_MAP[type] as EntityType;
        this.idLink = source.links.find((link) => link.name === idType);
      } else {
        this.idLink = undefined;
      }

      this.idHyperlinks = idHyperlinks?.map(unary(JSON.parse));
      this.searchLinks = SEARCH_LINKS.map(({ domain, url }) => ({
        url: links[domain.toLowerCase()] || url.replace("%s", allText),
        label: domain.replace("_", " "),
      }));
      this.internalSearchLinks = [
        {
          url: this.internalSearch.getVisualizerLink(allText),
          label: "Knowledge Graph",
        },
        {
          url: this.internalSearch.getFileContentLink(allText),
          label: "File Content",
        },
        {
          url: this.internalSearch.getFileContentLink(allText, {
            types: ["map"],
          }),
          label: "Map Content",
        },
      ];
    }
  }

  removeCustomAnnotation() {
    this.tooltipClose.emit();
    return this.annotationService.annotationRemoved(this.annotation.uuid);
  }
}
