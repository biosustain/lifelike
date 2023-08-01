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

import { FormArrayWithFactory } from '../../../../shared/utils/form/with-factory';
import { OpenFileProvider } from '../../../../shared/providers/open-file/open-file.provider';

@Component({
  selector: 'app-compose-prompt-form',
  templateUrl: './compose-prompt-form.component.html',
})
export class ComposePromptFormComponent implements OnChanges, OnInit {
  constructor(private readonly openFileProvider: OpenFileProvider) {}

  public form = new FormGroup({
    entities: new FormArrayWithFactory(() => new FormControl(''), []),
    context: new FormControl(''),
  });
  entitiesControl = this.form.controls.entities as FormArrayWithFactory<FormControl, string>;
  contextControl = this.form.controls.context as FormControl;
  @Input() entities!: Set<string>;
  @Input() context!: string;
  @Output() prompt = new EventEmitter<string>();

  contexts$: Observable<FilesystemObject['contexts']> = this.openFileProvider.object$.pipe(
    map(({ contexts }) => contexts),
    startWith([]),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  ngOnChanges({ entities, context }: SimpleChanges) {
    if (entities) {
      this.entitiesControl.setValue(Array.from(entities.currentValue ?? []));
    }
    if (context) {
      this.contextControl.setValue(context.currentValue);
    }
  }

  ngOnInit() {
    // We forward initial values to the form
    this.onSubmit();
  }

  parseEntitiesToPropmpt(entities: string[], context: string) {
    return (
      'What is the relationship between ' +
      entities.join(', ') +
      (context ? `, ${context}` : '') +
      '?'
      // + '\nPlease provide URL sources for your answer.'
    );
  }

  onSubmit() {
    return this.prompt.emit(
      this.parseEntitiesToPropmpt(
        this.form.controls.entities.value,
        this.form.controls.context.value
      )
    );
  }
}
