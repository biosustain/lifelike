import { OperatingSystems } from "app/interfaces/shared.interface";

import { getClientOS } from "./utils";

/**
 * Generates a downloadable file that is cross compatible
 * with multiple browsers.
 * @param blobData - the blob data
 * @param mimeType - mimetype
 * @param saveAs - the filename to save the file as (must include extension)
 */
export function downloader(blobData: any, mimeType: string, saveAs: string) {
  const newBlob = new Blob([blobData], { type: mimeType });
  // IE doesn't allow using a blob object directly as link href
  // instead it is necessary to use msSaveOrOpenBlob
  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveOrOpenBlob(newBlob);
    return;
  }
  // For other browsers:
  // Create a link pointing to the ObjectURL containing the blob.
  const data = window.URL.createObjectURL(newBlob);

  const link = document.createElement("a");
  link.href = data;
  link.download = saveAs;
  // this is necessary as link.click() does not work on the latest firefox
  link.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    })
  );

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
  const el = document.createElement("fakeelement");
  const transitions = {
    animation: "animationend",
    OAnimation: "oAnimationEnd",
    MozAnimation: "animationend",
    WebkitAnimation: "webkitAnimationEnd",
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

export const closePopups = (
  target: EventTarget = document,
  options?: MouseEventInit
) =>
  // events used to trigger popups closing might be consumed by libs like d3_zoom
  // this funciton triggers synthetic mouse down/up on document to close possible popups
  target.dispatchEvent(new MouseEvent("mousedown", options)) &&
  target.dispatchEvent(new MouseEvent("mouseup", options));

export const isScrollable = (element: Element) =>
  element.scrollHeight > element.clientHeight;

export const enclosingScrollableView = (element: Element) => {
  if (!element) {
    return null;
  }
  return isScrollable(element)
    ? element
    : enclosingScrollableView(element.parentElement);
};

export const isWithinScrollableView = (
  element: Element,
  container?: Element
) => {
  const defaultedContainer =
    container ?? enclosingScrollableView(element as HTMLElement);
  if (!defaultedContainer) {
    throw Error(
      "isWithinScrollableView has been called with invalid container declaration"
    );
  }
  const containerBBox = defaultedContainer.getBoundingClientRect();
  const elementBBox = element.getBoundingClientRect();

  if (
    elementBBox.top >= containerBBox.top &&
    elementBBox.bottom <= containerBBox.bottom &&
    elementBBox.left >= containerBBox.left &&
    elementBBox.right <= containerBBox.right
  ) {
    // enclosed
    return true;
  }

  if (
    elementBBox.top > containerBBox.bottom ||
    elementBBox.bottom < containerBBox.top ||
    elementBBox.left > containerBBox.right ||
    elementBBox.right < containerBBox.left
  ) {
    // out
    return false;
  }

  return {
    // partial
    top: elementBBox.top - containerBBox.top,
    bottom: elementBBox.bottom - containerBBox.bottom,
    left: elementBBox.left - containerBBox.left,
    right: elementBBox.right - containerBBox.right,
  };
};
