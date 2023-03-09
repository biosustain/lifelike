import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
} from "@angular/core";

import { FilesystemObject } from "app/file-browser/models/filesystem-object";

import { HighlightTextService } from "../services/highlight-text.service";

@Component({
  selector: "app-highlight-text",
  template: `<ng-content></ng-content>`,
  styleUrls: ["./highlight-text.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [HighlightTextService],
})
export class HighlightTextComponent implements OnChanges {
  @Input() object: FilesystemObject | undefined;

  constructor(protected readonly highlightTextService: HighlightTextService) {}

  ngOnChanges({ highlight, object }: SimpleChanges) {
    if (object) {
      this.highlightTextService.object = object.currentValue;
    }
  }
}
