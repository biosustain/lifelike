import { Observable } from 'rxjs';

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
  viewParams?: Promise<object>;
}
