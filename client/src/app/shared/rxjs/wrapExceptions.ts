import { HttpErrorResponse } from '@angular/common/http';

import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import * as Exceptions from '../exceptions';
import { UserError } from '../exceptions';

export const wrapExceptions = catchError(
  ({error}: HttpErrorResponse) => throwError(
    new (Exceptions[error?.type] ?? UserError)(error)
  )
);






