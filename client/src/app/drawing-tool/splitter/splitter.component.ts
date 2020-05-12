import {
  AfterViewInit,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  HostListener,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PdfViewerComponent } from '../pdf-viewer/pdf-viewer.component';
import { MapListComponent } from '../project-list-view/map-list/map-list.component';
import { Observable, Subscription } from 'rxjs';
import { LaunchApp } from '../services/interfaces';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { FileSelectionDialogComponent } from '../../file-browser/file-selection-dialog.component';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { ClipboardService } from '../../shared/services/clipboard.service';

@Component({
  selector: 'app-splitter',
  templateUrl: './splitter.component.html',
  styleUrls: ['./splitter.component.scss']
})
export class SplitterComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(
    'leftPanel',
    {static: false, read: ViewContainerRef}
  ) leftPanel: ViewContainerRef;

  splitPanelLength = 0;

  currentApp = '';
  currentMap = '';
  lastFileOpened: PdfFile;

  saveState = true;

  dynamicComponentRef: ComponentRef<any>;
  requestCloseSubscription: Subscription;
  fileOpenSubscription: Subscription;

  constructor(
    private injector: Injector,
    private r: ComponentFactoryResolver,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {
    if (this.route.snapshot.params.hash_id) {
      this.currentMap = this.route.snapshot.params.hash_id;
    }
  }

  ngOnInit() {

  }

  ngOnDestroy(): void {
    if (this.requestCloseSubscription) {
      this.requestCloseSubscription.unsubscribe();
    }
    if (this.fileOpenSubscription) {
      this.fileOpenSubscription.unsubscribe();
    }
  }

  ngAfterViewInit() {

  }

  // Prevent the user from leaving the page
  // if work is left un-saved
  @HostListener('window:beforeunload')
  canDeactivate(): Observable<boolean> | boolean {
    return this.saveState ? true : confirm(
      'WARNING: You have unsaved changes. Press Cancel to go back and save these changes, or OK to lose these changes.'
    );
  }

  resolveSaveState(saveState: boolean) {
    this.saveState = saveState;
  }

  /**
   *
   */
  close() {
    this.currentApp = '';
    this.leftPanel.clear();
    this.splitPanelLength = 0;
  }

  openApp(appCmd: LaunchApp) {
    // Check to see
    // - if the appCmd is NOT null
    // - if current app is NOT the same as new app to be opened
    // - if the app being opened is pdf-viewer
    // - if an argument is NOT supplied with the command
    if (
      appCmd &&
      this.currentApp !== appCmd.app &&
      appCmd.app === 'pdf-viewer' &&
      appCmd.arg === null
    ) {
      if (this.lastFileOpened) {
          localStorage.setItem('fileIdForPdfViewer', this.lastFileOpened.file_id);
          this._openApp(appCmd);
      } else {
        const dialogConfig = new MatDialogConfig();

        dialogConfig.width = '600px';
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = {};

        const dialogRef = this.dialog.open(FileSelectionDialogComponent, dialogConfig);
        dialogRef.beforeClosed().subscribe((file: PdfFile) => {
          if (file !== null) {
            localStorage.setItem('fileIdForPdfViewer', file.file_id);
            this._openApp(appCmd);
          }
        });
      }
    } else {
      this._openApp(appCmd);
    }
  }

  /**
   *
   * @param app - app such as pdf-viewer or kg-visualizer
   */
  _openApp(appCmd: LaunchApp) {
    if (!appCmd) {
      this.close();
      return;
    }

    // Don't waste time trying to re-open the app
    // if it's already opened
    if (this.currentApp !== appCmd.app) {
      let factory;

      switch (appCmd.app) {
        case 'map-search':
          factory = this.r.resolveComponentFactory(MapListComponent);
          this.splitPanelLength = 30;
          break;
        case 'pdf-viewer':
          factory = this.r.resolveComponentFactory(PdfViewerComponent);
          this.splitPanelLength = 50;
          break;
        default:
          break;
      }

      if (this.requestCloseSubscription) {
        this.requestCloseSubscription.unsubscribe();
      }
      if (this.fileOpenSubscription) {
        this.fileOpenSubscription.unsubscribe();
      }

      this.leftPanel.clear();
      this.currentApp = appCmd.app;

      this.dynamicComponentRef = this.leftPanel.createComponent(factory);

      if (this.dynamicComponentRef.instance.requestClose) {
        this.requestCloseSubscription = this.dynamicComponentRef.instance.requestClose.subscribe(() => {
          this.openApp(null);
        });
      }

      if (this.dynamicComponentRef.instance.fileOpen) {
        this.fileOpenSubscription = this.dynamicComponentRef.instance.fileOpen.subscribe(file => {
          this.lastFileOpened = file;
        });
      }

      this.dynamicComponentRef.changeDetectorRef.detectChanges();
    }

    // If an argument is supplied, inject into dynamic component
    if (this.currentApp === 'pdf-viewer' && appCmd.arg !== null) {
      this.dynamicComponentRef.instance.openPdf(
        appCmd.arg.fileId,
        {
          rect: appCmd.arg.coords,
          pageNumber: appCmd.arg.pageNumber
        }
      );
    }
  }
}
