import { Component, Input, OnChanges, SimpleChanges, TemplateRef } from "@angular/core";
import { Observable } from "rxjs";

import { FilesystemObject } from "app/file-browser/models/filesystem-object";
// import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ModuleContext } from "../../services/module-context.service";
import { CdkNativeDragItegration } from "../../utils/drag";

@Component({
  selector: "app-module-header",
  templateUrl: "./module-header.component.html",
})
export class ModuleHeaderComponent implements OnChanges {
  @Input() object!: FilesystemObject;
  @Input() titleTemplate: TemplateRef<any>;
  @Input() returnUrl: string;
  @Input() showObjectMenu = true;
  @Input() showBreadCrumbs = true;
  @Input() showNewWindowButton = true;
  @Input() dragTitleData$: Observable<Record<string, string>>;
  drag: CdkNativeDragItegration;

  constructor(
    // protected readonly filesystemService: FilesystemService,
    private tabUrlService: ModuleContext
  ) {}

  ngOnChanges({ dragTitleData$ }: SimpleChanges) {
    if (dragTitleData$) {
      this.drag =
        dragTitleData$.currentValue && new CdkNativeDragItegration(dragTitleData$.currentValue);
    }
  }

  openNewWindow() {
    return this.tabUrlService.shareableLink.then((href) => window.open(href));
  }

  toggleStarred() {
    // TODO: refine this behaviour with team
    // const {object} = this;
    // return this.filesystemService.updateStarred(object.hashId, !object.starred)
    //   .pipe(tap(result => object.update(result)))
    //   .toPromise();
  }
}
