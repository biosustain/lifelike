import { ErrorMessages } from '../constants/error';

export class NotImplemented extends Error {
  constructor(message = ErrorMessages.notImplemented) {
    super(message);
  }
}
