import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { isNil, isEqual, isEmpty, pick, partialRight, fromPairs } from 'lodash-es';
import { Subject, iif, of, defer } from 'rxjs';
import {
  takeUntil,
  map,
  shareReplay,
  distinctUntilChanged,
  switchMap,
  tap,
  filter,
  startWith,
} from 'rxjs/operators';

import { EntityType } from 'app/shared/schemas/annotation-types';
import { DatabaseType, ENTITY_TYPE_MAP, ENTITY_TYPES } from 'app/shared/constants/annotation-types';
import { CommonFormDialogComponent } from 'app/shared/modules/dialog/components/common/common-form-dialog.component';
import { MessageDialog } from 'app/shared/modules/dialog/services/message-dialog.service';
import { SEARCH_LINKS } from 'app/shared/constants/links';
import { AnnotationType } from 'app/shared/constants';
import { Hyperlink } from 'app/drawing-tool/services/interfaces';

import { Annotation, Meta } from '../annotation-type';

@Component({
  selector: 'app-annotation-panel',
  templateUrl: './annotation-edit-dialog.component.html',
  // needed to make links inside *ngFor to work and be clickable
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotationEditDialogComponent
  extends CommonFormDialogComponent<Annotation>
  implements OnInit
{
  @Input() set allText(allText: string) {
    this.form.patchValue({ text: allText });
  }
  @Input() pageNumber: number;
  @Input() keywords: string[];
  @Input() coords: number[][];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
    this.updateIdField$.subscribe();
    this.updateIncludeGlobally$.subscribe();
  }

  isTextEnabled = false;
  sourceLinks: Hyperlink[] = [];
  readonly destroyed$ = new Subject();

  readonly entityTypeChoices = ENTITY_TYPES;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };

  readonly form: FormGroup = new FormGroup({
    text: new FormControl(null, Validators.required),
    entityType: new FormControl('', Validators.required),
    id: new FormControl({ value: null, disabled: true }, Validators.required),
    source: new FormControl({ value: '', disabled: true }),
    sourceLinks: new FormArray([]),
    includeGlobally: new FormControl(false),
  });
  readonly caseSensitiveTypes = new Set([AnnotationType.Gene, AnnotationType.Protein]);
  readonly notAcceptedGloballyTypes = new Set([AnnotationType.Mutation, AnnotationType.Pathway]);

  entityType$ = this.getFormFieldObservable('entityType').pipe(
    tap((entityType) =>
      // always default to "No Source" on entity type change
      this.form.get('source').patchValue('')
    ),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  updateIncludeGlobally$ = this.entityType$.pipe(
    map((entityType) => this.notAcceptedGloballyTypes.has(entityType)),
    distinctUntilChanged(),
    tap((disableIncludeGlobally) => {
      const includeGloballyField = this.form.get('includeGlobally');
      if (disableIncludeGlobally) {
        includeGloballyField.disable();
        includeGloballyField.patchValue(false);
      } else {
        includeGloballyField.enable();
      }
    })
  );

  searchLinks$ = this.getFormFieldObservable('text').pipe(
    map((text) => text?.trim()),
    map((text) =>
      SEARCH_LINKS.map((link) => ({
        domain: link.domain.replace('_', ' '),
        link: this.substituteLink(link.url, text),
      }))
    )
  );

  databaseTypeChoices$ = this.entityType$.pipe(
    map((entityType) => {
      const dropdown = this.form.get('source');
      const { sources } = ENTITY_TYPE_MAP[entityType] ?? {};
      if (isEmpty(sources)) {
        dropdown.disable();
        return [];
      }
      dropdown.enable();
      return sources;
    }),
    takeUntil(this.destroyed$)
  );

  updateIdField$ = this.getFormFieldObservable('source').pipe(
    switchMap((source) => {
      const idField = this.form.get('id');
      if (source) {
        idField.patchValue('');
        idField.enable();
        return of(idField);
      } else {
        idField.disable();
        return this.getFormFieldObservables(['text', 'entityType']).pipe(
          map(({ text, entityType }) => {
            if (text && entityType) {
              const textId = this.caseSensitiveTypes.has(entityType) ? text : text?.toLowerCase();
              idField.patchValue(`${entityType}_${textId}`);
            } else {
              idField.patchValue('');
            }
            return idField;
          })
        );
      }
    }),
    tap((idField) => idField.updateValueAndValidity())
  );

  getFormFieldObservable(fieldName: string) {
    const field = this.form.get(fieldName);
    return defer(() => field.valueChanges.pipe(startWith(field.value), distinctUntilChanged()));
  }

  getFormFieldObservables(fieldNames: string[]) {
    return this.form.valueChanges.pipe(
      startWith(this.form.value),
      map(partialRight(pick, fieldNames)),
      distinctUntilChanged(isEqual)
    );
  }

  ngOnInit() {}

  getValue(): Annotation {
    // getRawValue will return values of disabled control too
    const { entityType, source, id, text, includeGlobally } = this.form.getRawValue();
    const idLinkUrl = ENTITY_TYPE_MAP[entityType]?.links.find((link) => link.name === source)?.url;
    if (idLinkUrl) {
      // Add this as a first item, as this is an expected convention
      this.sourceLinks.unshift({
        domain: source,
        url: `${idLinkUrl}${id}`,
      });
    }
    const meta = {
      id,
      isCustom: true,
      allText: text.trim(),
      includeGlobally,
      isCaseInsensitive: !this.caseSensitiveTypes.has(entityType),
      type: entityType,
      links: fromPairs(
        SEARCH_LINKS.map((link) => [link.domain.toLowerCase(), this.substituteLink(link.url, text)])
      ),
    } as Meta;
    if (source) {
      meta.idType = source;
    }
    if (this.sourceLinks) {
      meta.idHyperlinks = this.sourceLinks.map((link) =>
        JSON.stringify({ label: link.domain, url: link.url })
      );
    }

    return {
      pageNumber: this.pageNumber,
      keywords: this.keywords.map((keyword) => keyword.trim()),
      rects: this.coords.map((coord) => [coord[0], coord[3], coord[2], coord[1]]),
      meta,
    };
  }

  substituteLink(s: string, query: string) {
    return s.replace(/%s/, encodeURIComponent(query));
  }

  enableTextField() {
    this.isTextEnabled = true;
    this.form.get('text').enable();
  }
}
