import { Component, Input, TemplateRef, OnChanges, SimpleChanges, } from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';

interface TreeNode {
  label?: string;
  value?: string | number | boolean;
  children?: Array<any>;
}

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.scss']
})
export class TreeViewComponent implements OnChanges {
  @Input() dataSource;
  @Input() treeNode: TemplateRef<any>;
  @Input() nestedTreeNode: TemplateRef<any>;
  @Input() getChildren: (node: any) => Array<any> | undefined;
  @Input() hasChild: (node: any) => boolean;
  treeControl;

  ngOnChanges({getChildren, hasChild}: SimpleChanges) {
    if (getChildren) {
      this.treeControl = new NestedTreeControl<TreeNode>(getChildren.currentValue);
    }
    if (hasChild) {
      this.hasChild = n => hasChild.currentValue(undefined, n);
    }
  }
}
