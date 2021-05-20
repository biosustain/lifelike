import { SelectionModel } from '@angular/cdk/collections';
import { Input, OnDestroy, OnInit } from '@angular/core';

import { Subject, Subscription } from 'rxjs';

import { FlatNode } from 'app/shared/schemas/common';

import { GenericFlatTreeComponent } from '../generic-flat-tree/generic-flat-tree.component';

export abstract class ChecklistFlatTreeComponent<T> extends GenericFlatTreeComponent<T> implements OnDestroy, OnInit {
  @Input() resetTree: Subject<boolean>;

  selectionChangedSubscription: Subscription;

  /** The selection for checklist */
  checklistSelection = new SelectionModel<FlatNode<T>>(true /* multiple */);

  constructor() {
    super();
    this.selectionChangedSubscription = this.checklistSelection.changed.subscribe(() => this.selectionChanged());
  }

  ngOnInit() {
    this.resetTree.subscribe(() => this.reset());
  }

  ngOnDestroy() {
    this.resetTree.complete();
    this.selectionChangedSubscription.unsubscribe();
  }

  reset() {
    this.collapseAll();
    this.checklistSelection.clear();
  }

  /** Whether all the descendants of the node are selected. */
  descendantsAllSelected(node: FlatNode<T>): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected = descendants.length > 0 && descendants.every(child => {
      return this.checklistSelection.isSelected(child);
    });
    return descAllSelected;
  }

  /** Whether part of the descendants are selected */
  descendantsPartiallySelected(node: FlatNode<T>): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some(child => this.checklistSelection.isSelected(child));
    return result && !this.descendantsAllSelected(node);
  }

  /** Toggle item selection. Select/deselect all the descendants node */
  itemSelectionToggle(node: FlatNode<T>): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    this.checklistSelection.isSelected(node)
      ? this.checklistSelection.select(...descendants)
      : this.checklistSelection.deselect(...descendants);

    // Force update for the parent
    descendants.forEach(child => this.checklistSelection.isSelected(child));
    this.checkAllParentsSelection(node);
  }

  /** Toggle a leaf item selection. Check all the parents to see if they changed */
  leafItemSelectionToggle(node: FlatNode<T>): void {
    this.checklistSelection.toggle(node);
    this.checkAllParentsSelection(node);
  }

  /* Checks all the parents when a leaf node is selected/unselected */
  checkAllParentsSelection(node: FlatNode<T>): void {
    let parent: FlatNode<T> | null = this.getParentNode(node);
    while (parent) {
      this.checkRootNodeSelection(parent);
      parent = this.getParentNode(parent);
    }
  }

  /** Check root node checked state and change it accordingly */
  checkRootNodeSelection(node: FlatNode<T>): void {
    const nodeSelected = this.checklistSelection.isSelected(node);
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected = descendants.length > 0 && descendants.every(child => {
      return this.checklistSelection.isSelected(child);
    });
    if (nodeSelected && !descAllSelected) {
      this.checklistSelection.deselect(node);
    } else if (!nodeSelected && descAllSelected) {
      this.checklistSelection.select(node);
    }
  }

  /* Get the parent node of a node */
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

  abstract selectionChanged(): any;
}
