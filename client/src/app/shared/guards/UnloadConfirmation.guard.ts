import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';

import { ShouldConfirmUnload } from '../modules';

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class UnloadConfirmationGuard<T extends ShouldConfirmUnload> implements CanDeactivate<T> {
  canDeactivate(component: T): Promise<boolean> {
    return Promise.resolve(component.shouldConfirmUnload).then((shouldConfirmUnload) => {
      if (shouldConfirmUnload) {
        return confirm('Leave page? Changes you made may not be saved.');
      } else {
        return true;
      }
    });
  }
}
