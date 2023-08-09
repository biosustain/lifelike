import { HttpErrorResponse } from '@angular/common/http';

export class UserError {
  constructor({
    title,
    message,
    type = null,
    additionalMsgs = [],
    stacktrace = null,
    cause = null,
    transactionId = null,
  }) {
    this.title = title;
    this.message = message;
    this.type = type;
    this.additionalMsgs = additionalMsgs;
    this.stacktrace = stacktrace;
    this.cause = cause ? new UserError(cause) : undefined;
    this.transactionId = transactionId;
  }

  title: string;
  message: string;
  type: string;
  additionalMsgs: string[];
  stacktrace: string;
  cause: UserError;
  transactionId: string;
}

export class DeleteNonEmpty extends UserError {}

export const isOfflineError = (error) =>
  (error as HttpErrorResponse)?.status === 0 && !navigator.onLine;
