import { EventEmitter } from '@angular/core';

import { Observable } from 'rxjs';

export interface ModuleProperties {
  title: string;
  fontAwesomeIcon: string;
  badge?: string;
  loading?: boolean;
}

export interface ModuleAwareComponent {
  modulePropertiesChange?: EventEmitter<ModuleProperties>;
  linkParams?: Promise<Record<string, string>>;
}
