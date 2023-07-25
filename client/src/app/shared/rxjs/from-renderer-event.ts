import { Renderer2 } from '@angular/core';

import { Observable } from 'rxjs';

export const fromRendererEvent = <E extends Event>(renderer: Renderer2, element: HTMLElement, eventName: string) =>
  new Observable<E>(subscriber =>
    renderer.listen(
      element,
      eventName,
      (n) => subscriber.next(n),
    ),
  );
