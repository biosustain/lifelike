import { Observable } from 'rxjs';

import { Source } from 'app/drawing-tool/services/interfaces';

export interface ModuleProperties {
  title: string;
  fontAwesomeIcon: string;
  badge?: string;
  loading?: boolean;
}

export interface ShouldConfirmUnload {
  shouldConfirmUnload: boolean | Promise<boolean>;
  /**
   * If we guard against angular route unload, we should also guard against browser unload event.
   */
  // @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload: (event: BeforeUnloadEvent) => void | BeforeUnloadEvent | Promise<void | BeforeUnloadEvent>;
}

export interface ModuleAwareComponent {
  modulePropertiesChange?: Observable<ModuleProperties>;
  sourceData$?: Observable<Source[]>;
  linkParams?: Promise<Record<string, string>>;
}
