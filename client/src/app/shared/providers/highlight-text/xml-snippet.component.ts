import { Component, Injectable, Input, RendererFactory2 } from '@angular/core';

import { escape, uniqueId } from 'lodash-es';
import Color from 'color';

import { DatabaseLink, ENTITY_TYPE_MAP, EntityType } from 'app/shared/annotation-types';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import {
  Hyperlink,
  Reference,
  Source,
  UniversalGraphNode,
  UniversalGraphNodeTemplate,
} from 'app/drawing-tool/services/interfaces';
import { createNodeDragImage } from 'app/drawing-tool/utils/drag';
import { Meta } from 'app/pdf-viewer/annotation-type';

import { DropdownController } from '../../utils/dom/dropdown-controller';
import { GenericDataProvider } from '../data-transfer-data/generic-data.provider';
import { SEARCH_LINKS } from '../../links';
import { annotationTypesMap } from '../../annotation-styles';
import { XMLTag } from '../../services/highlight-text.service';
import { InternalSearchService } from '../../services/internal-search.service';
import { isCtrlOrMetaPressed } from '../../DOMutils';
import { composeInternalLink } from '../../workspace-manager';

@Component({
  selector: 'app-xml-snippet',
  template: `<ng-content></ng-content>`,
})
export class XMLSnippetComponent extends XMLTag {
  update() {}
}
