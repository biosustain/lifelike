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
