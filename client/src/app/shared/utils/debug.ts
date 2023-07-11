import { isDevMode } from '@angular/core';


export const inDevMode = (callback?) => isDevMode() ? callback?.() : null;
