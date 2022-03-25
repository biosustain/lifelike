import { Component, Input, Output, EventEmitter } from '@angular/core';

import { uniqueId } from 'lodash-es';

import { SEARCH_LINKS } from 'app/shared/links';
import { DatabaseLink, ENTITY_TYPE_MAP, EntityType } from 'app/shared/annotation-types';

@Component({
  selector: 'app-annotation-details',
  templateUrl: './annotation-details.component.html',
  styleUrls: ['./annotation-details.component.scss']
})
export class AnnotationDetailsComponent {
  uuid = uniqueId('app-annotation-details');

  @Input() annotation;
  @Output() removeAnnotationExclusion = new EventEmitter();

  SEARCH_LINKS = SEARCH_LINKS;

  idLink(annotation) {
    let idLink: DatabaseLink = null;

    if (ENTITY_TYPE_MAP.hasOwnProperty(annotation.meta.type)) {
      const source = ENTITY_TYPE_MAP[annotation.meta.type] as EntityType;
      idLink = source.links.filter(link => link.name === annotation.meta.idType)[0];
    }

    return idLink;
  }

  annoId(an) {
    const id = an.meta.id.indexOf(':') !== -1 ? an.meta.id.split(':')[1] : an.meta.id;
    return id?.indexOf('NULL') === -1 ? id : null;
  }
}
