import { Injectable, Inject } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DOCUMENT } from '@angular/common';
import { Platform } from '@angular/cdk/platform';

import { MessageType } from 'app/interfaces/message-dialog.interface';

import { MessageArguments, MessageDialog } from './message-dialog.service';
import { isPromise } from '../utils';

interface StatusMessages {
  success?: string;
  intermediate?: string;
}

/**
 * Service to copy text to clipboard and notify user about success or failure.
 * In compharison to the Clipboard service, this service also supports functions for intermidiate step
 * when copy content is generated.
 */
@Injectable({
  providedIn: 'root'
})
export class ClipboardService extends Clipboard {
  constructor(
    public readonly messageDialog: MessageDialog,
    public readonly snackBar: MatSnackBar,
    @Inject(DOCUMENT) private document: Document,
    private platform: Platform
  ) {
    super(document);
  }

  // region Legancy methods for accessing clipboard without Angular CDK Clipboard service
  private userHasSeenWarnings = false;

  private permissionState: PermissionState;

  getPermission(): Promise<PermissionState> {
    // TS generates an error saying 'clipboard-write` does not exist as an option for the 'name'
    // property, but in the context of Edge and Chromium browers, it does. So, we ignore the error.
    // @ts-ignore
    return navigator.permissions.query({name: 'clipboard-write'}).then(({state}) => {
      this.permissionState = state;
      return this.hasPermission() || new Error('Permission denied');
    });
  }

  hasPermission(): boolean {
    return this.permissionState === 'granted' || this.permissionState === 'prompt';
  }

  // ansync on the first attempt, but synchronous on consecutive ones
  writeWithPermission(text: string) {
    if (this.hasPermission()) {
      navigator.clipboard.writeText(text);
    } else {
      return this.getPermission().then(
        () => navigator.clipboard.writeText(text),
        () => this.error()
      );
    }
  }

  /**
   * NOTE: It is hard to reason if this method adds any value over Angular CDK's `copy` method.
   * Using it as fallback in case new implementation is failing.
   *
   * Asynchronously writes text content to the clipboard.
   *
   * This may not be possible in all browsers, and in such cases nothing is written to the clipboard.
   *
   * @param text the string to write to the user's clipboard
   */
  writeToClipboard(text: string): boolean | Promise<boolean> {
    const {platform} = this;

    if (platform.BLINK || platform.EDGE) {
      return this.writeWithPermission(text);
    } else if (platform.FIREFOX) {
      this.error(
        'We would like to write some information to your clipboard, however at this time ' +
        'Firefox does not allow us to do so. For the best experience using our app, we highly ' +
        'recommend using Chrome or Microsoft Edge.'
      );
    } else if (platform.SAFARI) {
      try {
        // At the time of writing, `navigator.permissions` does not exist in Safari,
        // so here we attempt to write the given text to the clipboard and expect the browser
        // to handle any permissions.
        navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // We should expect a NotAllowedError if the user does not accept the write permission
        console.log(error);
      }
    } else {
      this.error(
        'Unknown browser detected! Some features of the app may be disabled. For the best experience, ' +
        'we recommend using Chrome or Microsoft Edge'
      );
    }
  }

  // endregion

  private error(message?: string) {
    return this.messageDialog.display({
      type: MessageType.Error,
      title: 'Error',
      message: message ?? 'Copy failed. Please copy with your keyboard.'
    } as MessageArguments);
  }

  private success(message?: string) {
    return this.snackBar.open(message ?? 'Copied to clipboard.', null, {
      duration: 3000,
    });
  }

  immediateCopy(text: string, successMessage?): boolean | Promise<boolean> {
    if (super.copy(text)) {
      this.success(successMessage);
      return true;
    } else {
      return this.writeToClipboard(text);
    }
  }

  /**
   * If obtaining copy value takes longer than 1 animation frame show waiting message
   * @param text - promise of text to copy
   * @param intermediateMessage - message while waiting
   */
  delayedCopy(text: Promise<string>, {success, intermediate}: StatusMessages): Promise<boolean> {
    const intermediateMessageRef = this.snackBar.open(intermediate ?? 'Copying...');
    return text.then(txt => {
      intermediateMessageRef.dismiss();
      return this.immediateCopy(txt, success);
    });
  }

  // @ts-ignore
  copy(text: string | Promise<string>, statusMessages?: StatusMessages): boolean | Promise<boolean> {
    if (isPromise(text)) {
      return this.delayedCopy(text as Promise<string>, statusMessages);
    } else {
      return this.immediateCopy(text as string, statusMessages?.success);
    }
  }
}
