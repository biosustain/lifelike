import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { HighlightTextService } from '../services/highlight-text.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-highlight-text',
  templateUrl: './highlight-text.component.html',
  styleUrls: [
    './highlight-text.component.scss',
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighlightTextComponent implements OnInit, OnDestroy, OnChanges, AfterViewChecked {
  @ViewChild('container', { read: ElementRef }) containerRef: ElementRef;
  @Input() object: FilesystemObject | undefined;
  @Input() highlight: string;
  @Input() eventSubscriptions = true;

  private pendingRender = false;
  protected readonly subscriptions = new Subscription();

  constructor(protected readonly elementRef: ElementRef,
              protected readonly highlightTextService: HighlightTextService) {
  }

  ngOnInit() {
    if (this.eventSubscriptions) {
      this.subscriptions.add(this.highlightTextService.addEventListeners(this.elementRef.nativeElement, {
        object: this.object,
      }));
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('highlight' in changes) {
      this.pendingRender = true;
    }
  }

  ngAfterViewChecked() {
    if (this.pendingRender) {
      this.pendingRender = false;
      this.containerRef.nativeElement.innerHTML = this.highlightTextService.generateHTML(this.highlight);
    }
  }

}
