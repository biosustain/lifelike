import { EventEmitter } from '@angular/core';

import { Observable } from 'rxjs';

export interface ModuleProperties {
  title: string;
  fontAwesomeIcon: string;
  badge?: string;
  loading?: boolean;
}

export interface ModuleAwareComponent {
  modulePropertiesChange?: Observable<ModuleProperties>;
  viewParams?: Promise<object>;
}
