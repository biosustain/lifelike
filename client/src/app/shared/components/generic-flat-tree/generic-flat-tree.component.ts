import { FlatTreeControl } from '@angular/cdk/tree';
import { Input } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';

import { isNullOrUndefined } from 'util';

import {TreeNode, FlatNode} from 'app/shared/schemas/common';


export abstract class GenericFlatTreeComponent<T> {
  protected _treeData: TreeNode<T>[] = [];
  @Input() set treeData(treeData: TreeNode<T>[]) {
    this._treeData = treeData;
    this.dataSource.data = this._treeData;
  }
  get treeData() {
    return this._treeData;
  }

  treeControl: FlatTreeControl<FlatNode<T>>;
  treeFlattener: MatTreeFlattener<TreeNode<T>, FlatNode<T>>;
  dataSource: MatTreeFlatDataSource<TreeNode<T>, FlatNode<T>>;

  constructor() {
    this.treeControl = new FlatTreeControl<FlatNode<T>>(this.getLevel, this.isExpandable);
    this.treeFlattener = new MatTreeFlattener(this._transformer, this.getLevel, this.isExpandable, this.getChildren);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    this._initDataSource();
  }

  protected _initDataSource() {
    this.dataSource.data = this._treeData;
  }

  protected _transformer = (node: TreeNode<T>, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      data: node.data,
      level,
    };
  }

  getChildren = (node: TreeNode<T>): TreeNode<T>[] => node.children;

  hasNoContent = (_: number, node: FlatNode<T>) => isNullOrUndefined(node.data);

  getLevel = (node: FlatNode<T>) => node.level;

  isExpandable = (node: FlatNode<T>) => node.expandable;

  hasChild = (_: number, node: FlatNode<T>) => node.expandable;

  expandAll() {
    this.treeControl.expandAll();
  }

  collapseAll() {
    this.treeControl.collapseAll();
  }

  reset() {
    this.collapseAll();
  }
}
