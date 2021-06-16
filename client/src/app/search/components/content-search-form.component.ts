import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

// import { isNullOrUndefined } from 'util';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { FormComponent } from 'app/shared/components/base/form.component';

import { ContentSearchOptions } from '../content-search';

@Component({
  selector: 'app-content-search-form',
  templateUrl: './content-search-form.component.html',
})
export class ContentSearchFormComponent extends FormComponent<ContentSearchOptions> implements OnDestroy {
  @Input() set params(params: ContentSearchOptions) {
    super.params = {
      ...params,
      q: this.getQueryStringFromParams(params),
    };
  }
  @Output() formResult = new EventEmitter<ContentSearchOptions>();
  @Output() formChange = new EventEmitter<ContentSearchOptions>();

  form = new FormGroup({
    q: new FormControl(''),
  });

  formChangesSub: Subscription;

  constructor(messageDialog: MessageDialog) {
    super(messageDialog);

    // We want to be listening for changes immediately, so subscribe in the constructor. If we were to subscribe later (e.g. in `ngOnInit`)
    // we may not capture the very first change, which happens when the input `params` changes the first time.
    this.formChangesSub = this.form.valueChanges.pipe(
      debounceTime(250)
    ).subscribe(() => {
      this.formChange.emit({...this.form.value});
    });
  }

  ngOnDestroy() {
    this.formChangesSub.unsubscribe();
  }

  getQueryStringFromParams(params: ContentSearchOptions) {
    const q = [];
    if (params.hasOwnProperty('q') && params.q !== '') {
      q.push(params.q);
    }
    if (params.hasOwnProperty('wildcards') && params.wildcards !== '') {
      q.push(params.wildcards);
    }
    if (params.hasOwnProperty('phrase') && params.phrase !== '') {
      q.push(`"${params.phrase}"`);
    }
    if (params.hasOwnProperty('types') && params.types !== []) {
      params.types.forEach(type => q.push(`type:${type.shorthand}`));
    }
    if (params.hasOwnProperty('projects') && params.projects !== []) {
      params.projects.forEach(project => q.push(`project:${project}`));
    }
    // TODO: Add this back if we put synonyms back in the advanced search dialog
    // if (params.hasOwnProperty('synonyms') && !isNullOrUndefined(params.synonyms)) {
    //   q.push(`synonyms:${params.synonyms}`);
    // }

    return q.join(' ');
  }
}
