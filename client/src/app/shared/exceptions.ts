export class UserError {
  constructor({
                title,
                message,
                additionalMsgs = [],
                stacktrace = null,
                cause = null,
                transactionId = null
              }) {
    this.title = title;
    this.message = message;
    this.additionalMsgs = additionalMsgs;
    this.stacktrace = stacktrace;
    this.cause = cause;
    this.transactionId = transactionId;
  }

  title: string;
  message: string;
  additionalMsgs: string[];
  stacktrace: string;
  cause: string;
  transactionId: string;
}

export class DeleteNonEmpty extends UserError {
}
