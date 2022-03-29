import { OperatingSystems } from 'app/interfaces/shared.interface';

import { getClientOS } from './utils';

/**
 * Generates a downloadable file that is cross compatible
 * with multiple browsers.
 * @param blobData - the blob data
 * @param mimeType - mimetype
 * @param saveAs - the filename to save the file as (must include extension)
 */
export function downloader(blobData: any, mimeType: string, saveAs: string) {
  const newBlob = new Blob([blobData], {type: mimeType});
  // IE doesn't allow using a blob object directly as link href
  // instead it is necessary to use msSaveOrOpenBlob
  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveOrOpenBlob(newBlob);
    return;
  }
  // For other browsers:
  // Create a link pointing to the ObjectURL containing the blob.
  const data = window.URL.createObjectURL(newBlob);

  const link = document.createElement('a');
  link.href = data;
  link.download = saveAs;
  // this is necessary as link.click() does not work on the latest firefox
  link.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));

  setTimeout(() => {
    // For Firefox it is necessary to delay revoking the ObjectURL
    window.URL.revokeObjectURL(data);
    link.remove();
  }, 100);
}

/**
 * Determines which event listener to use (dependent on browser)
 */
export function whichTransitionEvent() {
  const el = document.createElement('fakeelement');
  const transitions = {
    animation: 'animationend',
    OAnimation: 'oAnimationEnd',
    MozAnimation: 'animationend',
    WebkitAnimation: 'webkitAnimationEnd',
  };

  for (const t in transitions) {
    if (el.style[t] !== undefined) {
      return transitions[t];
    }
  }
}

export function isAltOrOptionPressed(event: KeyboardEvent | MouseEvent) {
  return event.altKey;
}

export function isShiftPressed(event: KeyboardEvent | MouseEvent) {
  return event.shiftKey;
}

export function isCtrlOrMetaPressed(event: KeyboardEvent | MouseEvent) {
  const os = getClientOS();
  switch (os) {
    case OperatingSystems.MAC:
      return event.metaKey;
    default:
      return event.ctrlKey;
  }
}
