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
  AfterViewInit
} from '@angular/core';
import { trigger, style, transition, animate, state } from '@angular/animations';
import { KeyValue } from '@angular/common';
import { NestedTreeControl } from '@angular/cdk/tree';

import { BehaviorSubject, ReplaySubject, combineLatest } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';

import { inText, isNotEmpty } from 'app/shared/utils';
import { ExtendedMap } from 'app/shared/utils/types';

export interface SearchableTreeNode {
  id: string;
  name: string;
  children?: SearchableTreeNode[];
}

const filterSearchableTreeNode = (
  node: SearchableTreeNode,
  filter: (name: string) => boolean
): SearchableTreeNode => {
  const parsedNode = node.children ? {
    ...node,
    children: node.children.reduce(
      (filteredChildren, child) => {
        const newChild = filterSearchableTreeNode(child, filter);
        if (newChild) {
          filteredChildren.push(newChild);
        }
        return filteredChildren;
      },
      []
    )
  } : node;
  if (isNotEmpty(parsedNode.children) || filter(node.name)) {
    return parsedNode;
  }
};

@Component({
  selector: 'app-searchable-tree',
  styleUrls: ['./searchable-tree.component.scss'],
  templateUrl: './searchable-tree.component.html',
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
export class SearchableTreeComponent<Id, Item> implements OnChanges, AfterViewInit {
  @HostBinding('@blockInitialRenderAnimation') blockInitialRenderAnimation = true;
  value$ = new ReplaySubject<Id>(1);
  tree$ = new ReplaySubject<SearchableTreeNode>(1);
  search$ = new BehaviorSubject<string>('');
  filteredBranches$ = combineLatest([
    this.tree$,
    this.search$.pipe(map(searchTerm => inText(searchTerm)))
  ]).pipe(
    map(([node, searchFunction]) =>
      filterSearchableTreeNode(node, searchFunction).children
    ),
    tap(node => console.log(node))
  );
  @Output() changeValue = new EventEmitter<Id>();
  @Input() tree: SearchableTreeNode;
  @ContentChild('item', {static: true}) itemTemplateRef: TemplateRef<any>;
  @ViewChild(NgbDropdownMenu, {static: true}) dropdownMenu: NgbDropdownMenu;
  @ViewChild('search', {static: true}) searchInput;

  @Input() treeNode: TemplateRef<any>;
  @Input() treeNestedNode: TemplateRef<any>;
  treeControl = new NestedTreeControl<SearchableTreeNode>(({children}) => children);
  hasChild = (index: number, {children}: SearchableTreeNode) => isNotEmpty(children);
  order = (a: KeyValue<number, string>, b: KeyValue<number, string>): number => 0;

  searchChangeCallback(event: Event) {
    this.search$.next((event?.target as any)?.value);
  }

  ngOnChanges({tree, isOpen, getChildren, hasChild}: SimpleChanges) {
    if (tree) {
      this.tree$.next(tree.currentValue);
    }
  }

  ngAfterViewInit() {
    // this.treeControl.expandAll();
  }
}
