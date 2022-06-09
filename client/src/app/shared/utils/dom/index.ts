/**
 * Generator to walk through all parent elements in a tree, starting from a given element,
 * and yield all elements that pass a given predicate function, and still continuing if an
 * element gets a false from the predicate (unless specified otherwise).
 *
 * @param start the element to start from, which is also tested for the predicate
 * @param predicate the test element
 * @param continueAfterFail true to continue walking the whole hierarchy even after predicate failure
 */
export function* walkParentElements(start: Element,
                                    predicate: (element: Element) => boolean,
                                    continueAfterFail = true): Iterable<Element | undefined> {
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

export function* walkOverflowElementPairs(start: Element): Iterable<{ target: Element, viewport: Element } | undefined> {
  let current: Element = start.parentElement;
  let target: Element = start;
  while (current) {
    if (nonStaticPositionPredicate(current)) {
      yield {target, viewport: current};
      target = current;
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
