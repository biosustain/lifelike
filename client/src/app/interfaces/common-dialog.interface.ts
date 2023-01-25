import { Warnings } from '@angular/cli/lib/config/schema';

import { BehaviorSubject } from 'rxjs';

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
}

/**
 * Holds a progress update
 */
export class Progress {
  public mode: ProgressMode;
  public value: number;
  public status: string;

  constructor(args: ProgressArguments = {
    mode: ProgressMode.Indeterminate,
    value: 0,
    status: 'Working...'
  }) {
    this.mode = args.mode;
    this.value = args.value;
    this.status = args.status;
  }
}

export class ProgressSubject extends BehaviorSubject<Progress> {
  warnings$: BehaviorSubject<Readonly<WarningResponse[]>>;
  errors$: BehaviorSubject<Readonly<ErrorResponse[]>>;

  constructor(props: ProgressArguments) {
    super(new Progress(props));
    this.warnings$ = new BehaviorSubject<Readonly<WarningResponse[]>>([]);
    this.errors$ = new BehaviorSubject<Readonly<ErrorResponse[]>>([]);
  }

  get warnings() {
    return this.warnings$.getValue();
  }

  warning(warn: WarningResponse) {
    this.warnings$.next([
      ...this.warnings,
      warn
    ]);
  }

  get errors() {
    return this.errors$.getValue();
  }

  error(error: ErrorResponse) {
    this.errors$.next([
      ...this.errors,
      error
    ]);
  }

  next(value: ProgressArguments) {
    super.next(new Progress(value));
  }
}
