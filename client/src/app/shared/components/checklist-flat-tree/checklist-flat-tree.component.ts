import { SelectionModel } from '@angular/cdk/collections';
import { Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';

import { isNil } from 'lodash-es';
import { Observable, ReplaySubject, Subject, Subscription } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

import { FlatNode, TreeNode } from 'app/shared/schemas/common';

import { GenericFlatTreeComponent } from '../generic-flat-tree/generic-flat-tree.component';

export abstract class ChecklistFlatTreeComponent<T>
  extends GenericFlatTreeComponent<T>
  implements OnDestroy, OnChanges, OnInit
{
  @Input() set initiallyCheckedNodesFilterFn(filterFn: (t: FlatNode<T>) => boolean) {
    this._initiallyCheckedNodesFilterFn = filterFn;
    if (!isNil(this.treeData)) {
      this.checklistInit(this.flatNodes.filter(this._initiallyCheckedNodesFilterFn));
    }
  }

  @Input() set treeData(treeData: TreeNode<T>[]) {
    super.treeData = treeData;
    this.checklistInit(this.flatNodes.filter(this._initiallyCheckedNodesFilterFn));
  }
  get treeData() {
    return super.treeData;
  }

  constructor() {
    super();
    this.checklistSelection.changed
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.selectionChanged());
    this._initiallyCheckedNodesFilterFn = (t: FlatNode<T>) => false;
  }
  private readonly destroy$ = new Subject();
  private readonly _resetTree$$ = new ReplaySubject<Subject<boolean>>(1);
  private readonly _resetTree: Observable<boolean> = this._resetTree$$.pipe(
    switchMap((subject) => subject),
    takeUntil(this.destroy$)
  );
  @Input() resetTree: Subject<boolean>;

  private _initiallyCheckedNodesFilterFn: (t: FlatNode<T>) => boolean;

  /** The selection for checklist */
  checklistSelection = new SelectionModel<FlatNode<T>>(true /* multiple */);

  ngOnChanges({ resetTree }: SimpleChanges) {
    if (resetTree) {
      this._resetTree$$.next(resetTree.currentValue);
    }
  }

  ngOnInit() {
    this._resetTree.subscribe(() => this.reset());
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  reset() {
    this.collapseAll();
    this.checklistSelection.clear();
  }

  checklistInit(nodesToCheck: FlatNode<T>[]) {
    this.reset();
    nodesToCheck.forEach((flatNode) => {
      // Check and expand this node
      this.itemSelectionToggle(flatNode);
      this.treeControl.expand(flatNode);

      // Expand all parents as well
      let parent: FlatNode<T> | null = this.getParentNode(flatNode);
      while (parent) {
        this.treeControl.expand(parent);
        parent = this.getParentNode(parent);
      }
    });
  }

  /**
   * Determines whether all descendants of a node are selected.
   * @param node node whose descendants we will check
   * @returns true if all descendants are selected, false otherwise
   */
  descendantsAllSelected(node: FlatNode<T>): boolean {
    const descendants = this.treeControl.getDescendants(node);
    return (
      descendants.length > 0 &&
      descendants.every((child) => {
        return this.checklistSelection.isSelected(child);
      })
    );
  }

  /**
   * Determines whether some descendants of a node are selected.
   * @param node node whose descendants we will check
   * @returns true if some descendants are selected, false otherwise
   */
  descendantsPartiallySelected(node: FlatNode<T>): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const selectedDescendants = descendants.filter((child) =>
      this.checklistSelection.isSelected(child)
    );
    return selectedDescendants.length > 0 && selectedDescendants.length < descendants.length;
  }

  /**
   * Get the parent of a node. Return null if there is no parent.
   * @param node node to get the parent of
   * @returns the parent node, or null if there is no parent
   */
  getParentNode(node: FlatNode<T>): FlatNode<T> | null {
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  abstract itemSelectionToggle(node: FlatNode<T>): void;

  abstract selectionChanged(): any;
}
