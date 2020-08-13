import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class UnloadConfirmationGuard implements CanDeactivate<any> {
  canDeactivate(component): boolean | Observable<boolean> {
    return !component.shouldConfirmUnload || !component.shouldConfirmUnload()
      || confirm('Leave page? Changes you made may not be saved.');
  }
}
