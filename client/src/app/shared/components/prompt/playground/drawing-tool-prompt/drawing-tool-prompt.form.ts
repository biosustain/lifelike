import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { FormArrayWithFactory } from '../../../../utils/form/with-factory';
import {
  PromptComposer,
  PromptComposerDirective,
} from '../prompt-composer/prompt-composer.directive';
import { Observable } from 'rxjs';


@Component({
  selector: 'app-drawing-tool-prompt-form',
  templateUrl: './drawing-tool-prompt-form.component.html',
})
export class DrawingToolPromptFormComponent extends PromptComposerDirective implements OnChanges, PromptComposer {
  formInput = new FormGroup({
    entities: new FormArrayWithFactory(() => new FormControl(''), []),
    context: new FormControl(''),
  });
  // region Typed form controls to use in template
  entitiesControl = this.formInput.controls.entities as FormArrayWithFactory<FormControl>;
  // endregion
  prompt$: Observable<string>;

  ngOnChanges({entities, context, temperature}: SimpleChanges) {
    if (entities) {
      this.formInput.controls.entities.setValue(Array.from(entities.currentValue));
    }
    if (context) {
      this.formInput.controls.context.setValue(context.currentValue);
    }
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
}
