import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import { Subscription } from 'rxjs';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { HighlightTextService } from '../../services/highlight-text.service';
import { AppURL } from '../../url';

@Component({
  selector: 'app-generic-table',
  templateUrl: './generic-table.component.html',
  styleUrls: ['./generic-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [HighlightTextService],
})
export class GenericTableComponent implements OnChanges {
  @ViewChild('head', { read: ElementRef }) public head: ElementRef;
  @ViewChild('body', { read: ElementRef }) public body: ElementRef;

  @Input() object: FilesystemObject | undefined;
  @Input() header: TableHeader[][];
  @Input() entries: TableCell[][];

  constructor(
    protected readonly highlightTextService: HighlightTextService,
    public readonly elementRef: ElementRef
  ) {}

  ngOnChanges({ object }: SimpleChanges) {
    if (object) {
      this.highlightTextService.object = object.currentValue;
    }
  }
}

export interface TableCell {
  text: string;
  singleLink?: TableLink;
  multiLink?: TableLink[];
  highlight?: boolean;
}

export interface TableLink {
  link: string|AppURL;
  linkText: string;
}

export interface TableHeader {
  name: string;
  span: string;
}
