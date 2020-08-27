import { AbstractControl } from '@angular/forms';

export function getTopParent(control: AbstractControl) {
  let parent = control;
  while (parent.parent != null) {
    parent = parent.parent;
  }
  return parent;
}
