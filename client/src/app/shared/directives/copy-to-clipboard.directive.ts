import { Directive, Input } from '@angular/core';
import {CdkCopyToClipboard, Clipboard} from '@angular/cdk/clipboard';

import { ClipboardService } from '../services/clipboard.service';

/**
 * A directive that copies the text content of the host element into the clipboard and notifies the user about the result.
 * It is simple wrapper over CDK's copy-to-clipboard directive with remaped Clipboard reference.
 */
@Directive({
  selector: '[appCopyToClipboard]',
  providers: [{provide: Clipboard, useExisting: ClipboardService}]
})
export class CopyToClipboardDirective extends CdkCopyToClipboard {
  @Input('appCopyToClipboard') text = '';
}
