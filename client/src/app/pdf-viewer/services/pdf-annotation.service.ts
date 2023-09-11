import { Injectable, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  ReplaySubject,
  Subject,
  defer,
  of,
  iif,
} from 'rxjs';
import {
  distinctUntilChanged,
  first,
  map,
  shareReplay,
  switchMap,
  tap,
  filter,
} from 'rxjs/operators';
import { first as _first, groupBy, merge, isNil } from 'lodash-es';

import { AnnotationsService } from 'app/file-browser/services/annotations.service';
import {
  AnnotationExclusionCreateRequest,
  AnnotationExclusionDeleteRequest,
  CustomAnnotationCreateRequest,
  CustomAnnotationDeleteRequest,
} from 'app/file-browser/schema';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { ErrorResponse } from 'app/shared/schemas/common';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ENTITY_TYPE_MAP, ENTITY_TYPES, EntityType } from 'app/shared/annotation-types';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';

import { AnnotationExcludeDialogComponent } from '../components/annotation-exclude-dialog.component';
import { AnnotationHighlightResult } from '../pdf-viewer-lib.component';
import {
  AddedAnnotationExclusion,
  Annotation,
  RemovedAnnotationExclusion,
} from '../annotation-type';

class EntityTypeEntry {
  constructor(public type: EntityType, public annotations: Annotation[]) {}
}

@Injectable()
export class PDFAnnotationService {
  hashId: string;

  filterChange$ = new Subject<void>();
  annotations$ = new ReplaySubject<Annotation[]>(1);
  pageGroupedAnnotations$ = this.annotations$.pipe(
    map((annotations) => groupBy(annotations, 'pageNumber'))
  );
  /**
   * A mapping of annotation type (i.e. Genes) to a list of those annotations.
   */
  annotationEntityTypeMap$: Observable<Map<string, Annotation[]>> = this.annotations$.pipe(
    map((annotations) => {
      // Create index of annotation types
      const annotationEntityTypeMap = new Map();
      for (const annotation of annotations) {
        const entityType: EntityType = ENTITY_TYPE_MAP[annotation.meta.type];
        if (!entityType) {
          throw new Error(`unknown entity type ${annotation.meta.type} not in ENTITY_TYPE_MAP`);
        }
        let typeAnnotations = annotationEntityTypeMap.get(entityType.id);
        if (!typeAnnotations) {
          typeAnnotations = [];
          annotationEntityTypeMap.set(entityType.id, typeAnnotations);
        }
        typeAnnotations.push(annotation);
      }
      return annotationEntityTypeMap;
    })
  );
  sortedEntityTypeEntries$: Observable<EntityTypeEntry[]> = this.annotations$.pipe(
    map((annotations) =>
      ENTITY_TYPES.map(
        (entityType) =>
          new EntityTypeEntry(
            entityType,
            annotations.filter((ann) => ann.meta.type === entityType.id)
          )
      ).sort((a, b) => {
        if (a.annotations.length && !b.annotations.length) {
          return -1;
        } else if (!a.annotations.length && b.annotations.length) {
          return 1;
        } else {
          return a.type.name.localeCompare(b.type.name);
        }
      })
    )
  );
  highlightAnnotation$ = new BehaviorSubject<{
    id: string;
    text: string;
  }>(null);
  highlightAnnotationId$: Observable<string> = this.highlightAnnotation$.pipe(
    map((value) => value?.id)
    // Allowing for the same annotation to be returned consecutively to allow for
    // highlighting search to be reset when the user clicks on the same annotation.
    // https://sbrgsoftware.atlassian.net/browse/LL-5246
    // distinctUntilChanged()
  );
  foundHighlightAnnotations$ = this.highlightAnnotationId$.pipe(
    switchMap(
      (highlightAnnotationId) =>
        iif(
          () => isNil(highlightAnnotationId),
          of(null),
          this.annotations$.pipe(
            map((annotations) => ({
              id: highlightAnnotationId,
              annotations: annotations.filter(
                (annotation) => annotation.meta.id === highlightAnnotationId
              ),
              index$: new BehaviorSubject<number>(0),
            }))
          )
        ) as Observable<null | {
          id: number;
          annotations: Annotation[];
          index$: BehaviorSubject<number>;
        }>
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  highlightedAnnotation$ = this.foundHighlightAnnotations$.pipe(
    switchMap((foundHighlightAnnotations) =>
      iif(
        () => isNil(foundHighlightAnnotations),
        of(null),
        of(foundHighlightAnnotations).pipe(
          switchMap(({ annotations, index$ }) => index$.pipe(map((index) => annotations[index])))
        )
      )
    )
  );
  annotationHighlightChange$: Observable<AnnotationHighlightResult | null> =
    this.foundHighlightAnnotations$.pipe(
      switchMap((foundHighlightAnnotations) =>
        iif(
          () => isNil(foundHighlightAnnotations?.id),
          of(null),
          of(foundHighlightAnnotations).pipe(
            map(({ id, annotations, index$ }) => {
              const firstAnnotation: Annotation = _first(annotations);
              return {
                id,
                firstAnnotation,
                firstPageNumber: firstAnnotation?.pageNumber,
                found: annotations.length,
                index$,
              };
            }),
            tap(({ firstAnnotation, found, firstPageNumber }) =>
              found
                ? this.snackBar.open(
                    `Highlighted ${found} instance${found === 1 ? '' : 's'}  ` +
                      (firstAnnotation != null ? `of '${firstAnnotation.meta.allText}' ` : '') +
                      `in the document, starting on page ${firstPageNumber}.`,
                    'Close',
                    { duration: 5000 }
                  )
                : this.snackBar.open(
                    `The annotation could not be found in the document.`,
                    'Close',
                    { duration: 5000 }
                  )
            )
          )
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  set addedAnnotations(addedAnnotations: Annotation[]) {
    if (addedAnnotations) {
      this.annotations$
        .pipe(
          first(),
          tap((annotations) => {
            this.annotations$.next([...annotations, ...addedAnnotations]);
          })
        )
        .toPromise();
    }
  }

  constructor(
    protected readonly snackBar: MatSnackBar,
    protected readonly errorHandler: ErrorHandler,
    protected readonly modalService: NgbModal,
    protected readonly progressDialog: ProgressDialog,
    protected readonly annotationService: AnnotationsService
  ) {}

  openExclusionPanel(annExclusion) {
    const dialogRef = this.modalService.open(AnnotationExcludeDialogComponent);
    dialogRef.componentInstance.text = annExclusion.text;
    dialogRef.componentInstance.type = annExclusion.type;
    return dialogRef.result.then((exclusionData) =>
      this.annotationExclusionAdded({ ...exclusionData, ...annExclusion })
    );
  }

  updateAnnotationCollection(updateCallback: (annotations: Annotation[]) => Annotation[]) {
    return this.annotations$
      .pipe(
        first(),
        tap((annotations) => {
          this.annotations$.next(updateCallback(annotations));
        })
      )
      .toPromise();
  }

  set removedAnnotationIds(uuids: string[]) {
    if (uuids) {
      this.updateAnnotationCollection((currentAnnotations) =>
        currentAnnotations.filter((ann: Annotation) => !uuids.includes(ann.uuid))
      );
    }
  }

  set addedAnnotationExclusion(exclusionData: AddedAnnotationExclusion) {
    if (exclusionData) {
      this.markAnnotationExclusions(exclusionData);
    }
  }

  termsMatch(termInExclusion, termInAnnotation, isCaseInsensitive) {
    if (isCaseInsensitive) {
      return termInExclusion.toLowerCase() === termInAnnotation.toLowerCase();
    }
    return termInExclusion === termInAnnotation;
  }

  markAnnotationExclusions(exclusionData: AddedAnnotationExclusion) {
    return this.updateAnnotationCollection((annotations) =>
      annotations.map((ann) =>
        ann.meta.type === exclusionData.type &&
        this.termsMatch(exclusionData.text, ann.textInDocument, exclusionData.isCaseInsensitive)
          ? merge(
              {}, // provide obj copy to ensure that update propagates
              ann,
              {
                meta: {
                  isExcluded: true,
                  ...exclusionData,
                },
              }
            )
          : ann
      )
    );
  }

  unmarkAnnotationExclusions(exclusionData: RemovedAnnotationExclusion) {
    return this.updateAnnotationCollection((annotations) =>
      annotations.map((ann) =>
        ann.meta.type === exclusionData.type &&
        this.termsMatch(exclusionData.text, ann.textInDocument, ann.meta.isCaseInsensitive)
          ? merge(
              {}, // provide obj copy to ensure that update propagates
              ann,
              {
                meta: {
                  isExcluded: false,
                },
              }
            )
          : ann
      )
    );
  }

  set removedAnnotationExclusion(exclusionData: RemovedAnnotationExclusion) {
    if (exclusionData) {
      this.unmarkAnnotationExclusions(exclusionData);
    }
  }

  highlightAnnotation(annotationId: string) {
    this.highlightAnnotation$.next({
      id: annotationId,
      text: annotationId,
    });
  }

  annotationCreated(annotation: Annotation) {
    const dialogRef = this.modalService.open(ConfirmDialogComponent);
    dialogRef.componentInstance.message =
      'Do you want to annotate the rest of the document with this term as well?';
    return dialogRef.result.then(
      (annotateAll: boolean) => {
        const progressDialogRef = this.progressDialog.display({
          title: `Adding Annotations`,
          progressObservables: [
            new BehaviorSubject<Progress>(
              new Progress({
                status: 'Adding annotations to the file...',
              })
            ),
          ],
        });

        return this.annotationService
          .addCustomAnnotation(this.hashId, {
            annotation,
            annotateAll,
          })
          .pipe(this.errorHandler.create({ label: 'Custom annotation creation' }))
          .toPromise()
          .then(
            (annotations: Annotation[]) => {
              progressDialogRef.close();
              this.addedAnnotations = annotations;
              // TODO
              // this.enableEntityTypeVisibility(annotations[0]);
              this.snackBar.open('Annotation has been added', 'Close', { duration: 5000 });
            },
            (err) => {
              progressDialogRef.close();
            }
          );
      },
      () => {}
    );

    this.updateAnnotationCollection((annotations) => annotations.concat(annotation));
  }

  getAnnotations(hashId) {
    this.hashId = hashId;
    return this.annotationService.getAnnotations(hashId);
  }

  addCustomAnnotation(request: CustomAnnotationCreateRequest) {
    return this.annotationService.addCustomAnnotation(this.hashId, request);
  }

  addAnnotationExclusion(request: AnnotationExclusionCreateRequest) {
    return this.annotationService.addAnnotationExclusion(this.hashId, request);
  }

  removeCustomAnnotation(uuid: string, request: CustomAnnotationDeleteRequest) {
    return this.annotationService.removeCustomAnnotation(this.hashId, uuid, request);
  }

  highlightAllAnnotations(id: string | undefined, toggle = true) {
    return this.highlightAnnotation$.next(id ? { id, text: id } : null);
  }

  goToAnnotationHighlight(indexChangeCallback: (index: number) => number) {
    return this.annotationHighlightChange$
      .pipe(
        first(),
        filter((annotationHighlightChange) => !isNil(annotationHighlightChange)),
        switchMap(({ found, index$ }) =>
          index$.pipe(
            first(),
            map((index) => indexChangeCallback(index)),
            map((index) => (found + index) % found),
            tap((normalizedIndex) => index$.next(normalizedIndex))
          )
        )
      )
      .toPromise();
  }

  previousAnnotationHighlight() {
    return this.goToAnnotationHighlight((currentIndex) => currentIndex - 1);
  }

  nextAnnotationHighlight() {
    return this.goToAnnotationHighlight((currentIndex) => currentIndex + 1);
  }

  annotationRemoved(uuid) {
    const dialogRef = this.modalService.open(ConfirmDialogComponent);
    dialogRef.componentInstance.message =
      'Do you want to remove all matching annotations from the file as well?';
    return dialogRef.result.then(
      (removeAll: boolean) =>
        this.annotationService
          .removeCustomAnnotation(this.hashId, uuid, {
            removeAll,
          })
          .pipe(this.errorHandler.create({ label: 'Custom annotation removal' }))
          .toPromise()
          .then(
            (response) => {
              this.removedAnnotationIds = response;
              this.snackBar.open('Removal completed', 'Close', { duration: 10000 });
            },
            (err) => {
              this.snackBar.open(`Error: removal failed`, 'Close', { duration: 10000 });
            }
          ),
      () => {}
    );
  }

  annotationExclusionAdded(exclusionData: AddedAnnotationExclusion) {
    return this.annotationService
      .addAnnotationExclusion(this.hashId, {
        exclusion: exclusionData,
      })
      .pipe(this.errorHandler.create({ label: 'Custom annotation exclusion addition' }))
      .toPromise()
      .then(
        (response) => {
          this.addedAnnotationExclusion = exclusionData;
          this.snackBar.open(`${exclusionData.text}: annotation has been excluded`, 'Close', {
            duration: 10000,
          });
        },
        (err) => {
          this.snackBar.open(`${exclusionData.text}: failed to exclude annotation`, 'Close', {
            duration: 10000,
          });
        }
      );
  }

  annotationExclusionRemoved({ type, text }) {
    return this.annotationService
      .removeAnnotationExclusion(this.hashId, {
        type,
        text,
      })
      .pipe(this.errorHandler.create({ label: 'Custom annotation exclusion removal' }))
      .toPromise()
      .then(
        (response) => {
          this.removedAnnotationExclusion = { type, text };
          this.snackBar.open('Unmarked successfully', 'Close', { duration: 5000 });
        },
        (err: HttpErrorResponse) => {
          const error = err.error as ErrorResponse;
          this.snackBar.open(`${error.title}: ${error.message}`, 'Close', { duration: 10000 });
        }
      );
  }

  removeAnnotationExclusion(request: AnnotationExclusionDeleteRequest) {
    return this.annotationService.removeAnnotationExclusion(this.hashId, request);
  }
}
