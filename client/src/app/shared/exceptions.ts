export class UserError {
  constructor(public readonly title,
              public readonly message,
              public readonly detail = null,
              public readonly cause = null) {
  }
}
