import { EventEmitter } from '@angular/core';

export interface ModuleProperties {
  title: string;
  fontAwesomeIcon: string;
}

export interface ModuleAwareComponent {
  modulePropertiesChange?: EventEmitter<ModuleProperties>;
}
