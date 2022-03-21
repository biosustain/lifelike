import { ErrorMessages } from '../constants/error';

export class NotImplemented extends Error {
  constructor() {
    super(ErrorMessages.notImplemented);
  }
}
