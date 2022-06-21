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

  /**
   * NOTE: Leaving this code as legacy for now. Our application no longer is using this method (other than for disabled test).
   *
   * Asynchronously retrieves the text content of the clipboard.
   *
   * For some browsers this may not be possible, and in such cases this function will return
   * undefined.
   */
  // async readClipboard(): Promise<string> {
  //   const {platform} = this;
  //
  //   // TODO: We should check for CF_HTML prefix data if the browser is MS Edge. Currently, they only way to do
  //   // this would be to create a temp DOM element, register a paste event callback on the element, and then
  //   // trigger a paste event by programmatically pasting into the element. We could then potentially get the
  //   // CF_HTML formatted text. Obviously, this is a lot of hacky work for not a lot of payoff, so holding off on
  //   // the implementation for now.
  //   if (platform.BLINK || platform.EDGE) {
  //     // TS generates an error saying 'clipboard-read` does not exist as an option for the 'name'
  //     // property, but in the context of Edge and Chromium browers, it does. So, we ignore the error.
  //     // @ts-ignore
  //     const permissionsResult = await navigator.permissions.query({name: 'clipboard-read'});
  //     if (permissionsResult.state === 'granted' || permissionsResult.state === 'prompt') {
  //       return navigator.clipboard.readText();
  //     }
  //   } else if (platform.FIREFOX) {
  //     // Currently Firefox only allows read access to the clipboard in web extensions. See the compatibility
  //     // documentation for readText(): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
  //     if (!this.userHasSeenWarnings) {
  //       this.error(
  //         'We would like to read some information from your clipboard, however at this time ' +
  //         'Firefox does not allow us to do so. For the best experience using our app, we highly ' +
  //         'recommend using Chrome or Microsoft Edge.'
  //       );
  //       this.userHasSeenWarnings = true;
  //     }
  //   } else if (platform.SAFARI) {
  //     if (!this.userHasSeenWarnings) {
  //       this.error(
  //         'We would like to read some information from your clipboard. If the content of your ' +
  //         'clipboard was copied from a source other than Safari, you may see a "Paste" dialog appear ' +
  //         'after closing this dialog. Clicking on the "Paste" dialog will allow us to read your clipboard.'
  //       );
  //       this.userHasSeenWarnings = true;
  //     }
  //
  //     try {
  //       // At the time of writing, `navigator.permissions` does not exist in Safari,
  //       // so here we attempt to read the the clipboard and expect the browser
  //       // to handle any permissions.
  //       return navigator.clipboard.readText();
  //     } catch (error) {
  //       // We should expect a NotAllowedError if the user does not accept the read permission
  //       console.log(error);
  //     }
  //   } else {
  //     this.error(
  //       'Unknown browser detected! Some features of the app may be disabled. For the best experience, ' +
  //       'we recommend using Chrome or Microsoft Edge'
  //     );
  //   }
  // }

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
    console.error(message);
    return this.messageDialog.display({
      type: MessageType.Error,
      title: 'Error',
      message: message ?? 'Copy failed. Please copy with your keyboard.'
    } as MessageArguments);
  }

  private success(message?: string) {
    // Review note: Leftover?
    console.log('Copied!');
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
