import {
  Component,
  ContentChild,
  Input,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  ViewEncapsulation,
} from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';

import { BehaviorSubject, combineLatest, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';

import { inText, isNotEmpty } from 'app/shared/utils';

import { SearchableTreeNode } from './inteface';
import { filterSearchableTreeNode } from './utils';

@Component({
  selector: 'app-searchable-tree',
  templateUrl: './searchable-tree.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class SearchableTreeComponent implements OnChanges {
  readonly tree$ = new ReplaySubject<SearchableTreeNode>(1);
  readonly search$ = new BehaviorSubject<string>('');
  readonly filteredBranches$ = combineLatest([
    this.tree$,
    this.search$.pipe(map((searchTerm) => inText(searchTerm))),
  ]).pipe(
    map(([node, searchFunction]) => filterSearchableTreeNode(node, searchFunction)?.children ?? [])
  );
  @Input() tree: SearchableTreeNode;
  @Input() searchClass: string;

  @ContentChild('treeNode', { static: true }) treeNodeTemplateRef: TemplateRef<any>;
  @ContentChild('treeNestedNode', { static: true }) treeNestedNodeTemplateRef: TemplateRef<any>;
  treeControl = new NestedTreeControl<SearchableTreeNode>(({ children }) => children);
  hasChild = (index: number, node: SearchableTreeNode) =>
    isNotEmpty(this.treeControl.getChildren(node));
  trackByFn = (index: number, node: SearchableTreeNode) => node.id;

  searchChangeCallback(event: Event) {
    this.search$.next((event?.target as any)?.value);
  }

  ngOnChanges({ tree }: SimpleChanges) {
    if (tree) {
      this.tree$.next(tree.currentValue);
    }
  }
}