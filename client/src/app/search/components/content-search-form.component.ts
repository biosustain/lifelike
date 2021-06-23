import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { FormComponent } from 'app/shared/components/base/form.component';

import { ContentSearchOptions } from '../content-search';

@Component({
  selector: 'app-content-search-form',
  templateUrl: './content-search-form.component.html',
})
export class ContentSearchFormComponent extends FormComponent<ContentSearchOptions> implements OnDestroy {
  @Input() set queryString(queryString: string) {
    super.params = {
      q: queryString,
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
}
