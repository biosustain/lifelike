import { Component, Input } from '@angular/core';
import { UserError } from '../exceptions';
import { ErrorHandler } from '../services/error-handler.service';

@Component({
  selector: 'app-module-error',
  templateUrl: './module-error.component.html',
  styleUrls: [
    './module-error.component.scss'
  ],
})
export class ModuleErrorComponent {
  @Input() error: any;

  constructor(protected readonly errorHandler: ErrorHandler) {
  }

  get userError(): UserError {
    return this.error != null ? this.errorHandler.createUserError(this.error) : null;
  }
}
