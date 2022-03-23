import {
  Component,
  ViewEncapsulation,
  forwardRef,
  Input,
  OnChanges,
  SimpleChanges,
  ContentChild,
  TemplateRef,
  ViewChild,
  HostBinding,
  AfterViewInit
} from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { trigger, style, transition, animate, state } from '@angular/animations';

import { BehaviorSubject, ReplaySubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';

import { inText } from '../../utils';
import { ExtendedMap } from '../../utils/types';
import { defer } from 'lodash-es';


@Component({
  selector: 'app-searchable-dropdown-menu',
  styleUrls: ['./searchable-dropdown-menu.component.scss'],
  templateUrl: './searchable-dropdown-menu.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SearchableDropdownMenuComponent),
    multi: true
  }],
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
export class SearchableDropdownMenuComponent<Id, Item> implements ControlValueAccessor, OnChanges, AfterViewInit {
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
  public onTouched: any;
  public onChange: any;
  @Input() public items: Map<Id, Item>;
  @Input() isOpen = false;
  @ContentChild('item', {static: true}) itemTemplateRef: TemplateRef<any>;
  @ViewChild(NgbDropdownMenu, {static: true}) dropdownMenu: NgbDropdownMenu;
  @ViewChild('search', {static: true}) searchInput;
  @Input() optionTextAccessor: (item: Item) => string = (item: Item) => String(item);

  ngOnChanges({items, isOpen}: SimpleChanges) {
    if (items) {
      this.items$.next(items.currentValue instanceof ExtendedMap ? items.currentValue : new ExtendedMap(items.currentValue));
    }
    if (isOpen?.currentValue) {
      defer(this.searchInput.nativeElement.focus);
      defer(this.searchInput.nativeElement.select);
    }
  }

  ngAfterViewInit() {
    defer(this.searchInput.nativeElement.focus);
    defer(this.searchInput.nativeElement.select);
  }

  searchChangeCallback(event: Event) {
    this.search$.next((event?.target as any)?.value);
  }

  public writeValue(value: any): void {
    this.value$.next(value);
  }

  public registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  trackByKey(index: number, {key}) {
    return key;
  }
}
