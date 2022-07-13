import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';

import { Observable } from 'rxjs';

import { ModuleAwareComponent, ShouldConfirmUnload } from '../modules';

@Injectable({
  providedIn: 'root',
})
export class UnloadConfirmationGuard<T extends ShouldConfirmUnload> implements CanDeactivate<T> {
  canDeactivate(component: T): Promise<boolean> {
    return Promise.resolve(component.shouldConfirmUnload)
      .then(shouldConfirmUnload => {
        if (shouldConfirmUnload) {
          return confirm('Leave page? Changes you made may not be saved.');
        } else {
          return true;
        }
      });
  }
}
