import { assignInWith as _assignInWith } from 'lodash/fp';

import { OperatingSystems } from 'app/interfaces/shared.interface';

import { getClientOS } from '../index';

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

  const link = document.createElement('a');
  link.href = data;
  link.download = saveAs;
  // this is necessary as link.click() does not work on the latest firefox
  link.dispatchEvent(
    new MouseEvent('click', {
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

export const closePopups = (target: EventTarget = document, options?: MouseEventInit) =>
  // events used to trigger popups closing might be consumed by libs like d3_zoom
  // this funciton triggers synthetic mouse down/up on document to close possible popups
  target.dispatchEvent(new MouseEvent('mousedown', options)) &&
  target.dispatchEvent(new MouseEvent('mouseup', options));

const relativeRect = _assignInWith((fromProp, toProp) => toProp - fromProp);
export const relativePosition = (from: Element) => {
  const fromRect = from.getBoundingClientRect();
  return (to: Element) => {
    const toRect = to.getBoundingClientRect();
    return relativeRect(fromRect, toRect);
  };
};

export const isScrollable = (element: Element) => {
  if (element.scrollHeight > element.clientHeight) {
    const overflowProp = getComputedStyle(element).getPropertyValue('overflow-y');
    return overflowProp === 'auto' || overflowProp === 'scroll';
  }
};

export const enclosingScrollableView = (element: Element) => {
  if (!element) {
    return null;
  }
  return isScrollable(element) ? element : enclosingScrollableView(element.parentElement);
};

export const isWithinScrollableView = (element: Element, container?: Element) => {
  const defaultedContainer = container ?? enclosingScrollableView(element as HTMLElement);
  if (!defaultedContainer) {
    throw Error('isWithinScrollableView has been called with invalid container declaration');
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

/**
 * Shim to create a duck typed DOMRect because the DOMRect constructor is not supported everywhere.
 *
 * @param x the x
 * @param y the y
 * @param width width of the rect
 * @param height the height of the rect
 */
function createDOMRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON(): any {
      return JSON.stringify(this);
    },
  };
}

/**
 * Get the bounding client rect for an element considering scroll.
 *
 * @param element the element
 * @param rect a rect to use (otherwise the element's rect is used)
 */
export function getAbsoluteBoundingClientRect(
  element: Element,
  rect: DOMRect | undefined = null
): DOMRect | ClientRect {
  if (rect == null) {
    rect = element.getBoundingClientRect() as DOMRect;
  }
  let offsetX = window.scrollX;
  let offsetY = window.scrollY;

  if (element !== document.body) {
    let parent: Element = element.parentElement;

    while (parent !== document.body) {
      offsetX += parent.scrollLeft;
      offsetY += parent.scrollTop;
      parent = parent.parentElement;
    }
  }

  const x = rect.left + offsetX;
  const y = rect.top + offsetY;

  return createDOMRect(x, y, rect.width, rect.height);
}

/**
 * @deprecated - we have more powerfull version `relativePosition`
 * Get a DOMRect with its coordinates relative to the given container.
 *
 * @param rect the rect to make relative
 * @param container the container (may be scrollable)
 */
export function getBoundingClientRectRelativeToContainer(
  rect: DOMRect | ClientRect,
  container: Element
): DOMRect {
  const containerRect = getAbsoluteBoundingClientRect(container);
  return createDOMRect(
    rect.left - containerRect.left + container.scrollLeft,
    rect.top - containerRect.top + container.scrollTop,
    rect.width,
    rect.height
  );
}

/**
 * Generator to walk through all parent elements in a tree, starting from a given element,
 * and yield all elements that pass a given predicate function, and still continuing if an
 * element gets a false from the predicate (unless specified otherwise).
 *
 * @param start the element to start from, which is also tested for the predicate
 * @param predicate the test element
 * @param continueAfterFail true to continue walking the whole hierarchy even after predicate failure
 */
export function* walkParentElements(
  start: Element,
  predicate: (element: Element) => boolean,
  continueAfterFail = true
): Iterable<Element | undefined> {
  let current: Element = start;
  while (current) {
    if (predicate(current)) {
      yield current;
    } else {
      if (!continueAfterFail) {
        break;
      }
    }
    current = current.parentElement;
  }
}

/**
 * A predicate that tests whether an element has a position that makes children elements
 * within have a position relative to the given element.
 *
 * @param element the given element
 */
export const nonStaticPositionPredicate = (element: Element): boolean => {
  const position = window.getComputedStyle(element).getPropertyValue('position');
  return position === 'absolute' || position === 'fixed' || position === 'relative';
};

export interface NodeTextRange {
  // Start and end node could refer to the same element!
  startNode: Node;
  endNode: Node;
  start: number;
  end: number;
}
