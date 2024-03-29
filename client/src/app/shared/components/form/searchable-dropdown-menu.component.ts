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
  Output,
} from '@angular/core';
import { trigger, style, transition, animate, state } from '@angular/animations';
import { KeyValue } from '@angular/common';

import { BehaviorSubject, ReplaySubject, combineLatest } from 'rxjs';
import { map, tap } from 'rxjs/operators';
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
      state(
        'in',
        style({
          transform: 'initial',
          height: 'initial',
          marginTop: 'initial',
          paddingTop: 'initial',
          marginBottom: 'initial',
          paddingBottom: 'initial',
        })
      ),
      transition(':enter', [
        style({
          transform: 'scaleY(0)',
          height: 0,
          marginTop: 0,
          paddingTop: 0,
          marginBottom: 0,
          paddingBottom: 0,
        }),
        animate(100),
      ]),
      transition(
        ':leave',
        animate(
          100,
          style({
            transform: 'scaleY(0)',
            height: 0,
            marginTop: 0,
            paddingTop: 0,
            marginBottom: 0,
            paddingBottom: 0,
          })
        )
      ),
    ]),
    trigger('blockInitialRenderAnimation', [transition(':enter', [])]),
  ],
})
export class SearchableDropdownMenuComponent<Id, Item> implements OnChanges {
  @HostBinding('@blockInitialRenderAnimation') blockInitialRenderAnimation = true;
  readonly value$ = new ReplaySubject<Id>(1);
  readonly items$ = new ReplaySubject<ExtendedMap<Id, Item>>(1);
  readonly search$ = new BehaviorSubject<string>('');
  readonly filteredItems$ = combineLatest([
    this.items$,
    this.search$.pipe(map((searchTerm) => inText(searchTerm))),
  ]).pipe(
    map(([items, searchFunction]) =>
      items.filter(([id, item]) => searchFunction(this.optionTextAccessor(id, item)))
    ),
    tap((items) => console.log(items))
  );
  @Output() changeValue = new EventEmitter<Id>();
  @Input() public items: Map<Id, Item>;
  @ContentChild('item', { static: true }) itemTemplateRef: TemplateRef<any>;
  @ViewChild(NgbDropdownMenu, { static: true }) dropdownMenu: NgbDropdownMenu;
  @ViewChild('search', { static: true }) searchInput;
  order = (a: KeyValue<number, string>, b: KeyValue<number, string>): number => 0;
  @Input() optionTextAccessor: (id, item: Item) => string = (id, item: Item) => String(item);

  ngOnChanges({ items, isOpen }: SimpleChanges) {
    if (items) {
      this.items$.next(
        items.currentValue instanceof ExtendedMap
          ? items.currentValue
          : new ExtendedMap(items.currentValue)
      );
    }
  }

  searchChangeCallback(event: Event) {
    this.search$.next((event?.target as any)?.value);
  }
}
