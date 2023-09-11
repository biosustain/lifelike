import { Observable } from 'rxjs';

export const fromEventCapture = <E extends Event>(
  // Iteresting side note:
  // Currently this observable simply keeps firering events if element is removed from DOM.
  // It would be more elegant to call complete in this case.
  // This could be done by using MutationObserver (reference parent and listen for child removal).
  // Although possible, this would be more complex and would require more testing.
  element: HTMLElement,
  eventName: string
) =>
  new Observable<E>((subscriber) => {
    const handler = (n) => subscriber.next(n);
    element.addEventListener(eventName, handler, true);
    return () => element.removeEventListener(eventName, handler, true);
  });
