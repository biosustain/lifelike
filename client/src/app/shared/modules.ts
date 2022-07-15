import { Observable } from 'rxjs';

import { Source } from 'app/drawing-tool/services/interfaces';

export interface ModuleProperties {
  title: string;
  fontAwesomeIcon: string;
  badge?: string;
  loading?: boolean;
}

export interface ModuleAwareComponent {
  modulePropertiesChange?: Observable<ModuleProperties>;
  viewParams?: Promise<object>;
  getExportableLink$?: Observable<Source[]>;
}
