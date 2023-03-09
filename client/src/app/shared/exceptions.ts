import { HttpErrorResponse } from "@angular/common/http";

export class UserError {
  title: string;
  message: string;
  additionalMsgs: string[];
  stacktrace: string;
  cause: string;
  transactionId: string;

  constructor({
    title,
    message,
    additionalMsgs = [],
    stacktrace = null,
    cause = null,
    transactionId = null,
  }) {
    this.title = title;
    this.message = message;
    this.additionalMsgs = additionalMsgs;
    this.stacktrace = stacktrace;
    this.cause = cause;
    this.transactionId = transactionId;
  }
}

export class DeleteNonEmpty extends UserError {}

export const isOfflineError = (error) =>
  (error as HttpErrorResponse)?.status === 0 && !navigator.onLine;
