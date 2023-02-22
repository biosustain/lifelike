import { Warnings } from '@angular/cli/lib/config/schema';

import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ErrorResponse, WarningResponse } from 'app/shared/schemas/common';

export enum ProgressMode {
  Determinate = 'DETERMINATE',
  Indeterminate = 'INDETERMINATE',
  Buffer = 'BUFFER',
  Query = 'QUERY',
}

export interface ProgressArguments {
  mode?: ProgressMode;
  /**
   * An optional number between 0 and 1 (inclusive) indicating percentage.
   */
  value?: number;
  status?: string;
  warnings?: WarningResponse[];
  errors?: ErrorResponse[];
}

/**
 * Holds a progress update
 */
export class Progress {
  public readonly mode: ProgressMode;
  public readonly value: number;
  public readonly status: string;
  public readonly warnings?: Readonly<WarningResponse[]>;
  public readonly errors?: Readonly<ErrorResponse[]>;

  constructor(args: ProgressArguments = {
    mode: ProgressMode.Indeterminate,
    value: 0,
    status: 'Working...',
  }) {
    this.mode = args.mode;
    this.value = args.value;
    this.status = args.status;
    this.warnings = Object.freeze(args.warnings);
    this.errors = Object.freeze(args.errors);
  }
}
