import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { ErrorHandler as ErrorHandlerService } from 'app/shared/services/error-handler.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';

import { ErrorLogMeta } from '../schemas/common';

@Injectable()
export class MockErrorHandler extends ErrorHandlerService {
  constructor() {
    super(undefined, undefined);
  }

  logError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    return Promise.resolve(this.createUserError(error)).then((userError) => {
      console.warn(userError, logInfo);
      return userError;
    });
  }

  showError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    return Promise.allSettled([
      this.logError(error, logInfo),
      Promise.resolve(this.createUserError(error)).then((userError) => {
        throw userError;
      }),
    ]);
  }
}
