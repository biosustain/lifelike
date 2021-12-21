import {
  Component,
  Input,
  ViewEncapsulation,
  Output,
  EventEmitter,
  ViewChildren,
  OnChanges,
  SimpleChanges,
  ElementRef
} from '@angular/core';

import { SearchEntity } from './interfaces';

@Component({
  selector: 'app-sankey-search-panel',
  templateUrl: './search-panel.component.html',
  styleUrls: ['./search-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeySearchPanelComponent implements OnChanges {
  @Input() entities: SearchEntity[];
  @Input() searchTerms: string[];
  @Input() focusedIdx: number;
  @Output() focusedIdxChange = new EventEmitter<number>();
  @ViewChildren('item', {read: ElementRef}) listItems;

  ngOnChanges({focusedIdx, entities}: SimpleChanges): void {
    if (focusedIdx && this.listItems) {
      const itemNode = this.listItems.toArray()[focusedIdx.currentValue];
      if (itemNode) {
        const {nativeElement} = itemNode;
        if (nativeElement.scrollIntoViewIfNeeded) {
          nativeElement.scrollIntoViewIfNeeded();
        } else {
          itemNode.nativeElement.scrollIntoView(true);
        }
      }
    }
  }
}
