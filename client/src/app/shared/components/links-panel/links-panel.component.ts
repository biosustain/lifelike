import { Component, HostListener, Input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { cloneDeep, sortBy } from 'lodash-es';
import { isMatch as _isMatch, first as _first, last as _last } from 'lodash/fp';

import { LinkEditDialogComponent } from 'app/drawing-tool/components/map-editor/dialog/link-edit-dialog.component';
import { Hyperlink, Source } from 'app/drawing-tool/services/interfaces';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { VISUALIZER_URI_TOKEN } from 'app/visualization/providers/visualizer-object-data.provider';
import { WorkspaceManager } from 'app/workspace/services/workspace-manager';

import { openPotentialExternalLink, toValidLink } from '../../utils/browser';
import { AbstractControlValueAccessor } from '../../utils/forms/abstract-control-value-accessor';
import { DataTransferDataService } from '../../services/data-transfer-data.service';
import { MessageDialog } from '../../modules/dialog/services/message-dialog.service';
import {
  LABEL_TOKEN,
  LIFELIKE_URI_TOKEN,
  URI_TOKEN,
  URIData,
} from '../../providers/data-transfer-data/generic-data.provider';

@Component({
  selector: 'app-links-panel',
  templateUrl: './links-panel.component.html',
  styleUrls: ['./links-panel.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: LinksPanelComponent,
      multi: true,
    },
  ],
})
export class LinksPanelComponent extends AbstractControlValueAccessor<(Source | Hyperlink)[]> {
  @Input() title = 'Links';
  @Input() singularTitle = 'Link';
  @Input() showHeader = true;
  @Input() editable = true;
  @Input() fontAwesomeIcon = 'fa fa-link';
  @Input() draggable = true;
  @Input() limit = null;

  dropTargeted = false;
  activeLinkIndex = -1;

  constructor(
    protected readonly dataTransferData: DataTransferDataService,
    protected readonly modalService: NgbModal,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly messageDialog: MessageDialog
  ) {
    super();
  }

  getDefaultValue(): (Source | Hyperlink)[] {
    return [];
  }

  @HostListener('dragover', ['$event'])
  dragOver(event: DragEvent) {
    if (this.editable) {
      this.dropTargeted = true;
      event.dataTransfer.dropEffect = 'copy';
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @HostListener('dragenter', ['$event'])
  dragEnter(event: DragEvent) {
    if (this.editable) {
      this.dropTargeted = true;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @HostListener('dragend', ['$event'])
  dragEnd(event: DragEvent) {
    this.dropTargeted = false;
  }

  @HostListener('dragleave', ['$event'])
  dragLeave(event: DragEvent) {
    this.dropTargeted = false;
  }

  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    if (this.editable) {
      event.preventDefault();
      event.stopPropagation();
      this.dropTargeted = false;

      const items = this.dataTransferData.extract(event.dataTransfer);
      let text: string | undefined = null;
      const uriData: URIData[] = [];

      for (const item of sortBy(items, 'confidence')) {
        if ([URI_TOKEN, LIFELIKE_URI_TOKEN, VISUALIZER_URI_TOKEN].includes(item.token)) {
          uriData.unshift(...(item.data as URIData[]));
        } else if (item.token === LABEL_TOKEN) {
          text = item.data as string;
        }
      }

      let uri = _first(uriData)?.uri;
      // KGsearch returns a list of URIs, where last one tends to be a publication link
      if (_isMatch(uri, { pathSegments: ['kg-visualizer'] })) {
        for (const uriRecord of uriData) {
          if (_isMatch(uriRecord.uri, { pathSegments: ['kg-visualizer'] })) {
            continue;
          }
          uri = uriRecord.uri;
        }
      }

      return this.openCreateDialog({
        url: uri?.href ?? '',
        domain: text.trim(),
      });
    }
  }

  openCreateDialog(
    link: Source | Hyperlink = {
      domain: '',
      url: '',
    }
  ): Promise<Source> {
    const dialogRef = this.modalService.open(LinkEditDialogComponent);
    dialogRef.componentInstance.title = `New ${this.singularTitle}`;
    dialogRef.componentInstance.link = link;
    dialogRef.componentInstance.accept = (value: Source | Hyperlink) => {
      this.value = [...(this.value || []), value];
      this.activeLinkIndex = -1;
      this.valueChange();
      return Promise.resolve(link);
    };
    return dialogRef.result;
  }

  openEditDialog(link: Source | Hyperlink): Promise<Source> {
    const dialogRef = this.modalService.open(LinkEditDialogComponent);
    dialogRef.componentInstance.title = `Edit ${this.singularTitle}`;
    dialogRef.componentInstance.link = cloneDeep(link);
    dialogRef.componentInstance.accept = (value: Source | Hyperlink) => {
      for (const key of Object.keys(link)) {
        link[key] = value[key];
      }
      this.valueChange();
      return Promise.resolve(link);
    };
    return dialogRef.result;
  }

  delete(index: number) {
    this.value.splice(index, 1);
    this.activeLinkIndex = -1;
    this.valueChange();
  }

  getText(domain: string) {
    if (domain === '') {
      return 'Link';
    } else if (domain === 'Upload URL') {
      return 'External URL';
    } else {
      return domain;
    }
  }

  getUrlText(url: string) {
    if (url.startsWith('/')) {
      return window.location.hostname;
    } else {
      try {
        const urlObject = new URL(toValidLink(url));
        return urlObject.hostname.replace(/^www./, '') || url;
      } catch {
        return url;
      }
    }
  }

  toValidUrl(url: string) {
    try {
      return toValidLink(url);
    } catch (e) {
      return '#';
    }
  }

  linkClick(event: Event, link: Source | Hyperlink) {
    try {
      openPotentialExternalLink(this.workspaceManager, link.url.toString(), {
        newTab: true,
        sideBySide: true,
      });
    } catch (e) {
      this.messageDialog.display({
        title: 'Invalid Link',
        message: 'The URL for this link is not valid.',
        type: MessageType.Error,
      });
    }
    event.preventDefault();
    event.stopPropagation();
  }

  linkFocus(event: FocusEvent, link: Source | Hyperlink, index: number) {
    this.activeLinkIndex = index;
  }
}