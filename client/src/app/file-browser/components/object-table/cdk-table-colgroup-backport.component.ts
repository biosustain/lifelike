/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { CDK_TABLE, CdkTable } from '@angular/cdk/table';
import { CollectionViewer } from '@angular/cdk/collections';

/**
 * Wrapper for the CdkTable with colgroup backport.
 * https://github.com/angular/components/pull/18135
 * Don't need it once we upgrade to Angular 10
 */
@Component({
  selector: 'app-cdk-table-colgroup-backport, table[app-cdk-table-colgroup-backport]',
  exportAs: 'cdkTable',
  template: `
    <ng-content select="caption"></ng-content>
    <ng-content select="colgroup, col"></ng-content>
    <ng-container headerRowOutlet></ng-container>
    <ng-container rowOutlet></ng-container>
    <ng-container footerRowOutlet></ng-container>
  `,
  // tslint:disable-next-line:no-host-metadata-property
  host: {
    class: 'cdk-table',
  },
  encapsulation: ViewEncapsulation.None,
  // The "OnPush" status for the `MatTable` component is effectively a noop, so we are removing it.
  // The view for `MatTable` consists entirely of templates declared in other views. As they are
  // declared elsewhere, they are checked when their declaration points are checked.
  // tslint:disable-next-line:validate-decorators
  changeDetection: ChangeDetectionStrategy.Default,
  providers: [{ provide: CDK_TABLE, useExisting: AppCdkTableColgroupBackportComponent }],
})
export class AppCdkTableColgroupBackportComponent<T>
  extends CdkTable<T>
  implements AfterContentChecked, CollectionViewer, OnDestroy, OnInit {}
