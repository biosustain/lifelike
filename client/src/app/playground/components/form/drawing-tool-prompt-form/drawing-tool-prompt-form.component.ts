import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { OpenFileProvider } from 'app/shared/providers/open-file/open-file.provider';
import { FormArrayWithFactory } from 'app/shared/utils/forms/with-factory';

import { PromptComposer } from '../../../interface';
import { ChatGPT } from '../../../ChatGPT';

export interface DrawingToolPromptFormParams {
  formInput: {
    context: string;
    entities: string[];
  };

  contexts: string[];
}

@Component({
  selector: 'app-drawing-tool-prompt-form',
  templateUrl: './drawing-tool-prompt-from.component.html',
})
export class DrawingToolPromptFormComponent implements OnChanges, PromptComposer, OnInit {
  TEMPLATE = `
Given list of terms delimited by ${ChatGPT.DELIMITER}, explain what is the relationship between them?
List of terms: ${ChatGPT.DELIMITER}
  ...[entities],
  [context]
${ChatGPT.DELIMITER}
  `;
  readonly form = new FormGroup({
    context: new FormControl(''),
    entities: new FormArrayWithFactory(() => new FormControl(''), []),
  });
  @Output() readonly prompt$ = new EventEmitter<string>();
  @Input() formInput: DrawingToolPromptFormParams['formInput'];
  @Input() contexts: DrawingToolPromptFormParams['contexts'] = [];

  ngOnChanges({ formInput }: SimpleChanges) {
    if (formInput) {
      this.form.patchValue(formInput.currentValue);
    }
  }

  parseEntitiesToPropmpt(entities: string[], context: string) {
    return (
      `Given list of terms delimited by ${ChatGPT.DELIMITER}, ` +
      `explain what is the relationship between them?\n` +
      `List of terms: ${ChatGPT.DELIMITER}\n` +
      `\t${entities.join(`\n\t`)}\n` +
      `${ChatGPT.DELIMITER}`
    );
  }

  emitPrompt() {
    this.prompt$.emit(
      this.parseEntitiesToPropmpt(this.form.value.entities, this.form.value.context)
    );
  }

  onSubmit() {
    this.emitPrompt();
  }

  ngOnInit() {
    this.emitPrompt();
  }
}
