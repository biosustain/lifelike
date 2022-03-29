import {
  Component,
  ViewEncapsulation,
  Input,
  OnChanges,
  SimpleChanges,
  ContentChild,
  TemplateRef,
  ViewChild,
  HostBinding,
  EventEmitter,
  Output
} from '@angular/core';
import { trigger, style, transition, animate, state } from '@angular/animations';

import { BehaviorSubject, ReplaySubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';

import { inText } from '../../utils';
import { ExtendedMap } from '../../utils/types';


@Component({
  selector: 'app-searchable-dropdown-menu',
  styleUrls: ['./searchable-dropdown-menu.component.scss'],
  templateUrl: './searchable-dropdown-menu.component.html',
  encapsulation: ViewEncapsulation.None,
  animations: [
    trigger('collapseAnimation', [
      state('in', style({
        transform: 'initial',
        height: 'initial',
        marginTop: 'initial',
        paddingTop: 'initial',
        marginBottom: 'initial',
        paddingBottom: 'initial',
      })),
      transition(
        ':enter',
        [
          style({
            transform: 'scaleY(0)',
            height: 0,
            marginTop: 0,
            paddingTop: 0,
            marginBottom: 0,
            paddingBottom: 0
          }),
          animate(100)
        ]
      ),
      transition(
        ':leave',
        animate(100, style({
          transform: 'scaleY(0)',
          height: 0,
          marginTop: 0,
          paddingTop: 0,
          marginBottom: 0,
          paddingBottom: 0
        }))
      )
    ]),
    trigger(
      'blockInitialRenderAnimation',
      [
        transition(':enter', [])
      ]
    )
  ]
})
export class SearchableDropdownMenuComponent<Id, Item> implements OnChanges {
  @HostBinding('@blockInitialRenderAnimation') blockInitialRenderAnimation = true;
  value$ = new ReplaySubject<Id>(1);
  items$ = new ReplaySubject<ExtendedMap<Id, Item>>(1);
  search$ = new BehaviorSubject<string>('');
  filteredItems$ = combineLatest([
    this.items$,
    this.search$.pipe(map(searchTerm => inText(searchTerm)))
  ]).pipe(
    map(([items, searchFunction]) =>
      items.filter(([, item]) => searchFunction(this.optionTextAccessor(item)))
    )
  );
  @Output() changeValue = new EventEmitter<Id>();
  @Input() public items: Map<Id, Item>;
  @ContentChild('item', {static: true}) itemTemplateRef: TemplateRef<any>;
  @ViewChild(NgbDropdownMenu, {static: true}) dropdownMenu: NgbDropdownMenu;
  @ViewChild('search', {static: true}) searchInput;
  @Input() optionTextAccessor: (item: Item) => string = (item: Item) => String(item);

  ngOnChanges({items, isOpen}: SimpleChanges) {
    if (items) {
      this.items$.next(items.currentValue instanceof ExtendedMap ? items.currentValue : new ExtendedMap(items.currentValue));
    }
  }

  searchChangeCallback(event: Event) {
    this.search$.next((event?.target as any)?.value);
  }

}
