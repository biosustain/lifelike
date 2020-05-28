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
import {ActivatedRoute} from '@angular/router';

import {PdfViewerComponent} from '../pdf-viewer/pdf-viewer.component';
import {MapListComponent} from '../project-list-view/map-list/map-list.component';
import {Observable, Subscription} from 'rxjs';
import {LaunchApp, Location} from '../services/interfaces';
import {MatDialog, MatDialogConfig} from '@angular/material/dialog';
import {FileSelectionDialogComponent} from '../../file-browser/file-selection-dialog.component';
import {PdfFile} from '../../interfaces/pdf-files.interface';
import {NodeSearchComponent} from '../../node-search/containers/node-search.component';



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

  /**
   * A pre-cursor function before launching app
   * that assemble argument to open other apps
   * through dialog if they haven't been specified
   * @param appCmd - represent the app instruction schema to open app as desired
   */
  openApp(appCmd: LaunchApp) {

    if (!appCmd) {
      this.close();
      return;
    } else if (appCmd.app === 'pdf-viewer' && appCmd.arg === null) {
      // If the app being opened is a pdf-viewer with arg field set to null,
      // prompt a dialog for the user to pick a file and create the arg field
      // from the user's file chocie

      const dialogConfig = new MatDialogConfig();

      dialogConfig.width = '600px';
      dialogConfig.disableClose = true;
      dialogConfig.autoFocus = true;
      dialogConfig.data = {};

      const dialogRef = this.dialog.open(FileSelectionDialogComponent, dialogConfig);
      dialogRef.beforeClosed().subscribe((file: PdfFile) => {
        appCmd.arg = {
          fileId: file.file_id
        };
        this._openApp(appCmd);
      });
    } else {
      this._openApp(appCmd);
    }
  }

  /**
   *
   * @param app - app such as pdf-viewer or kg-visualizer
   */
  _openApp(appCmd: LaunchApp) {

    // Don't waste time trying to re-open the app
    // if it's already opened
    if (this.currentApp !== appCmd.app) {
      let factory;

      switch (appCmd.app) {
        case 'map-search':
          factory = this.r.resolveComponentFactory(MapListComponent);
          this.splitPanelLength = 30;
          break;
        case 'node-search':
          factory = this.r.resolveComponentFactory(NodeSearchComponent);
          this.splitPanelLength = 30;
          break;
        case 'pdf-viewer':
          factory = this.r.resolveComponentFactory(PdfViewerComponent);
          this.splitPanelLength = 50;
          break;
        default:
          break;
      }

      this.leftPanel.clear();
      this.currentApp = appCmd.app;

      this.dynamicComponentRef = this.leftPanel.createComponent(factory);

      this.dynamicComponentRef.changeDetectorRef.detectChanges();
    }

    // If an argument is supplied, inject into dynamic component
    if (this.currentApp === 'pdf-viewer' && appCmd.arg !== null) {
      // Form argument parameter signature for the openPDF function call
      // from the arg field of the app cmd
      const pdfFile: PdfFile = {
        file_id: appCmd.arg.fileId
      };

      // If no other parameters provided for opening the pdf ann ..
      // default to null
      const loc: Location = appCmd.arg.pageNumber !== null ? {
        pageNumber: appCmd.arg.pageNumber,
        rect: appCmd.arg.coords
      } : null;

      this.dynamicComponentRef.instance.openPdf(
        pdfFile,
        loc
      );
    }
  }
}
