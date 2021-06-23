# Frontend Design Guide

## Introduction

Our CSS framework, of which a major portion consists of Bootstrap 4, provides:

* layout styles
* styles for standard controls like form inputs
* useful components like dropdowns, cards, modals, tooltips, and tab bars
* and a set of utility classes like standard margin classes
* a standard set of SCSS variables

We use the Bootstrap SCSS files combined with the NG Bootstrap library to make the interactive components work.

## General Guidelines

Before we get too deep into designing specific components, let's review the main principles that theoretically guide how we build Lifelike.

### Human Interface

* **Immediate feedback:** We never want the user to second guess their input. For API requests or background tasks, indicate to the user that something is happening, either through a modal progress / working dialog or placeholders. All API requests must provide some feedback, even if the API requests normally return quickly.
* **Error handling:** We always plan for the best case, but sometimes the worst case happens. Indicate to the user that an error happened through a modal dialog or by inserting text into the result area.
* **Severity consideration:** Responses to user action should match the impact of the action. If the user uploads a file and it fails, the error should not be shown in a snackbar popup that disappears in a few seconds, because the action is *deliberate* and *major*, while the error response is *minor* and *fleeting*. What if the user had stepped away from the computer for a minute anyway and missed the popup?
* **Consolidated navigation:** We don't want the user to search visually around the page to see where a certain function was placed: was the edit link in the toolbar? the menu? on each individual row? below the result list? To do so, we try to reduce the number of "interaction areas" on any given page. In fact, we may sometimes even want to duplicate a function in different places on the same page.
* **Discoverability:** We don't want the user to have to read a user manual to learn how to use the application. Lead the user to take the next step by providing hints or by making it obvious. Never leave the user staring at a screen where the user has to guess what the next action is.
* **Minimal loss of user data:** Users are using their time to enter data into our application and it is important that we never waste their time. Consider all scenarios where data loss could be a problem, even in dialog boxes where a failed API request would result in the loss of the data provided in the modal dialog.
* **Consistent usage of color:** Colors provide extra weight to an element,and it's important that we never use unnecessary colors. *Just because* Bootstrap provides warning and danger classes, we do not have to use them.
* **Intentional wrapping:** Browsers wrap 

### Code Style

* **2 spaces, no tabs**

* **Minimal component CSS:** If you need to write custom CSS for a component, first consider if it can be done with Bootstrap's atomic CSS classes (margin, padding, display, etc. shortcuts), but if it can't be done, consider if the CSS can be global and usable by other components (for example, a tile view should not be in a component because it's likely it will be needed in other places). Very few components should require their own CSS file.

* **Consistent class method order:** Make it easy to follow code across the project by listing methods in the general order of initialization methods (`constructor()`, `ngOnIt()`), destruction (`ngOnDestroy()`), model (`ngOnChanges()`, `setMap()`, `getMap()`), template (`isMember()`, `isAdmin()`), helpers (`truncateText()`): 

* **Method grouping:** If a class gets large and can't be split up, consider grouping methods together and providing the following comment to separate groups:

  ```typescript
  // ========================================
  // Dialogs
  // ========================================
  ```

* **Consistent method names:**

  * Modal dialogs: `display[$SUBJECT]$FUNCTIONDialog()`

* **Consistent file naming scheme:**

  * General layout: `$SUBJECT-$FUNCTION[-$TYPE].component.[ts|html]`
  * Browsers/lists: `$SUBJECT-browser.component.[ts|html]`
  * Dialogs: `$SUBJECT-dialog.component.[ts|html]` (type = `dialog`)
    * Creation: `$SUBJECT-create-dialog.[ts|html]`
    * Editing: `$SUBJECT-edit-dialog.[ts|html]`
    * Delete confirmation: `$SUBJECT-delete-dialog.[ts|html]`

* **Consistent Angular module structure:**

  * `components/`
    * Don't put individual components in their own folder.
  * `services/`
  * `$MODULE-module.ts`

## Page Layout

The first part of building a piece of Lifelike is to layout the page:

### Wrapper

Most pages should use our own module component that provides the header, toolbar area, and main body:

```html
<div class="module module-centered">
  <div class="module-header-container">
    <div class="module-header">
      <div class="module-title">
        Module Title
      </div>

      <div class="module-toolbar">
        Optional toolbar
      </div>
    </div>
  </div>

  <div class="module-body">
  </div>

</div>
```

Some parts of the application, notably the search, does not use this wrapper.

### Flex Layout

Within the body portion, you should use CSS flex to layout the page (note: do NOT use Angular Flex Layout). Bootstrap provides a number of flex-related CSS classes:

```html
<div class="d-flex align-items-center">
    <div class="flex-fill">
        Main area
    </div>
    <div>
        Right side
    </div>
</div>
```

Bootstrap's CSS classes are a direct analog of CSS flex (unlike Angular Flex Layout, which is why we avoid it), so you may need to review CSS flex layouts if you are not familiar with them.

### Column Layout

If you want equally wide columns, you can use Bootstrap's column's framework:

```html
<div class="row">
    <div class="col-4">
        This column is 4/12 width
    </div>
    <div class="col-8">
        This column is 8/12 width
    </div>
</div>
```

The column suffixes must not exceed 12.

### Fixed Toolbar Layout

In some cases, you may want a toolbar portion that stays fixed and always visible but then have a scrollable content area. You can do that easily with flex by using the following pattern:

```html
<div class="d-flex flex-column h-100"> <!-- The height 100% makes our flex component take up
										    the entire vertical height of application body area -->
    <div>
        Toolbar
    </div>
    <div class="flex-fill overflow-auto"> <!-- flex-fill sets flex: 1 1 auto and then we apply
											   overflow: auto to add the scrollbar -->
        This part is scrollable
    </div>
</div>
```

### Spacing Between Elements

Once you have placed the components on the page that need to be there (tabs, toolbars, paragraphs, etc.), they should be appropriately spaced from each other to *look good*.

The best way to space components apart is to use Bootstrap's margin/padding utility classes (`m-1`, `mt-1`, `m-2`, `mb-2`, etc.). Do NOT use Trachyon's utility classes (`mt1`, `mb1`, etc.) because they aren't relative Bootstrap's CSS `$spacer` SCSS variable.

```html
<div>
    <app-loading-indicator></app-loading-indicator>
</div>
<div class="mt-1">
    {{ loadingText }}
</div>
```

Use whatever spacing (1-4) looks the best.

## Forms

### Angular Implementation

All forms, if possible, should be backed by a `FormGroup` in Angular.

### Form Layout

Using the `form-group` class, we can achieve correct standard separation between form elements:

```html
<div class="form-group">
    <label for="email">Email address</label>
    <input type="email" class="form-control" id="email">
</div>
```

However, if we want horizontal forms (which are the common layout of forms in Lifelike), we can combine it with the column framework:

```html
<div class="form-group">
    <label class="col-sm-3">Label</label>
    <div class="col-sm-3">
        Input field
    </div>
</div>
```

Note: The `-sm-` infix defines responsive behavior, so if the viewport becomes smaller than the "sm" (small) breakpoint, the columns will cease to exist.

Generally though, instead of write the HTML for form groups by hand, you can use our custom Angular component:

```html
<app-form-row for="password" label="Password" [control]="form.get('password')">
	<input type="password" formControlName="password" id="password" [appFormInput]="form.get('password')">
</app-form-row>
```

You can optionally provide an `AbstractControl` (i.e. a `new FormControl()`) as a parameter to `app-form-row` and it will use it to display form errors automatically.

### Form Errors

We can use Bootstrap's feedback classes to display form errors underneath inputs:

```html
<div class="invalid-feedback d-block">
	This field is required.
</div>
```

However, you can use our custom Angular component to automatically show form errors:

```html
<app-form-input-feedback [control]="control" [errors]="errors"></app-form-input-feedback>
```

The errors argument is **optional**, but can be used to provide messages for custom validator error message keys:

```typescript
const errors = {
	invalidName: 'The provided name is not valid.',
    minLength: 'The provided name is too short.',
}
```

You do not need to provide the errors parameter if you only use certain standard errors (feel free to add standard errors to the `app-form-input-feedback` component though, because it is missing some standard validator error keys).

### Checkboxes

Bootstrap provides a custom checkbox:

```html
<div class="custom-control custom-checkbox">
    <input type="checkbox" class="custom-control-input" id="public">
    <label class="custom-control-label" for="public">Make this map viewable by others</label>
</div>
```

### Single Selection Dropdowns

```html
<select class="custom-select">
	<option>Knuckle Puck</option>
</select>
```

### Multiple Selection Dropdowns

If you need to show a `<select>` with multiple selection, use our own component:

```html
<app-select formId="entity-types" [choices]="entityTypeChoices" style="width: 200px"
            [values]="form.value.entityTypes" (valuesChange)="form.get('entityTypes').setValue($event)"
            (touch)="form.get('entityTypes').markAsTouched()"
            [choiceLabel]="choiceLabel">
</app-select>
```

## Modals

Note:

* Use the `MessageDialog` service if you want to show generic message dialogs.
* We do not yet have a generic confirmation dialog service :( so you currently have to waste time building your own confirmation dialogs.
* We also do not yet have a generic simple input dialog service.
* If you want to fix the two above issues, please consider rolling the functionality into `MessageDialog` (see the library `sweetalert2` for inspiration).

### Modal Component

Modals (dialogs) must be in their own component and they should extend `CommonDialogComponent` (unless it's a form dialog, which we will cover later).

```typescript
@Component({
  selector: 'app-example-dialog',
  templateUrl: './example-dialog.component.html',
})
export class ExampleDialogComponent extends CommonDialogComponent {
    constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
        super(modal, messageDialog);
    }

    getValue() {
        return {}; // The value here is received by the calling component
    }
}
```

* The selector should be in the form of `app-$SUBJECT-dialog` and the component should be in the form of `$SUBJECTDialogComponent`.

The dialog can be opened with the following snippet (where `modalService` is an instance of `NgbModal`)

```typescript
const dialogRef = this.modalService.open(MapEditDialogComponent);
dialogRef.componentInstance.data = data;
dialogRef.result.then(data => {
    // Do stuff with data (returned form getValue())
}, () => {
    // User pressed cancel
});
```

### Modal HTML

Bootstrap provides a set of modal classes, but it is preferred that you use our own Angular components:

```html
<app-modal-header (cancel)="cancel()">
   	Modal Title
</app-modal-header>

<app-modal-body>
    Modal body
</app-modal-body>

<app-modal-footer>
    <button type="button" class="btn btn-secondary mr-2" (click)="cancel()">Cancel</button>
    <button type="submit" class="btn btn-primary">Submit</button>
</app-modal-footer>

```

Notes:

* The modal title should be in Title Case
* The main button should be `btn-primary` in all cases except when it is doing a destructive action when it should be `btn-danger`
* The cancel button must be left of the submit button, separated by `mr-2` and styled as `btn-secondary`

### Modals with Forms

If you are creating a modal that really is a form, extend `CommonFormDialogComponent` instead:

```typescript
@Component({
  selector: 'app-map-edit-dialog',
  templateUrl: './map-edit-dialog.component.html',
})
export class MapEditDialogComponent extends CommonFormDialogComponent {
  @Input() map: KnowledgeMap;

  readonly form: FormGroup = new FormGroup({
      label: new FormControl('', Validators.required),
      description: new FormControl(),
      public: new FormControl(false)
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
	super(modal, messageDialog);
  }

  getValue(): KnowledgeMap {
    return {
        ...this.form.value;
    }
  }
}
```

Note:

* The field `form` is REQUIRED.

* Do NOT override `submit()` unless you have to, and if you have to, maintain the message dialog that appears:

  ```typescript
  submit(): void {
    if (!this.form.invalid) {
      super.submit();
    } else {
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      });
    }
  }
  ```

The template HTML must also be a little different:

```html
<form [formGroup]="form" (ngSubmit)="submit()">
  <app-modal-header (cancel)="cancel()">
    Edit Map
  </app-modal-header>

  <app-modal-body>
    <app-form-row for="label" label="Name" [control]="form.get('label')">
      <input type="text" formControlName="label" id="label" [appFormInput]="form.get('label')" appAutoFocus>
    </app-form-row>

    <app-form-row for="description" label="Description" [control]="form.get('description')">
      <textarea formControlName="description" id="description" [appFormInput]="form.get('description')"
                rows="10"></textarea>
    </app-form-row>

    <app-form-row [control]="form.get('description')">
      <div class="custom-control custom-checkbox">
        <input type="checkbox" class="custom-control-input" id="public" formControlName="public">
        <label class="custom-control-label" for="public">Make this map viewable by others</label>
      </div>
    </app-form-row>
  </app-modal-body>

  <app-modal-footer>
    <button type="button" class="btn btn-secondary mr-2" (click)="cancel()">Cancel</button>
    <button type="submit" class="btn btn-primary">Save</button>
  </app-modal-footer>
</form>
```

Notice how we bind the submit of the form to `submit()`.

Note:

* Do NOT disable the submit button if the form has invalid input because this is confusing. Make SURE that the field with the invalid input is highlighted.

## Showing Progress

TODO

## Utility Classes

While we use Tachyon as well, please use Bootstrap classes whenever applicable, especially when spacing, color, or sizing is involved because Bootstrap's classes use our variables.

### Display

* **display:** `d-block`, `d-inline-block`, `d-table-cell`, `d-flex`, `d-none`, etc.
* **position:** `position-static`, `position-relative`, `position-absolute`, etc.
* **float:** `float-left`, `float-right`
* **width:** `w-25`, `w-50`, `w-75`, `w-100`, `w-auto`
* **height:** `h-25`, `h-50`, ...
* **max width:** `mw-100`
* **margin:** `m-auto`, `m-0`, `m-1`, ..., `m-4` (also `ml`, `mr`, `mt`, `mb`, `mx`, `my`) - note: these use the `$spacer` variable 
* **padding:** `p-0`, `p-1`, ...
* **vertical alignment:** `align-baseline`, `align-top`, `align-middle`, `align-bottom`, etc.
* **overflow:** `overflow-auto`, `overflow-hidden`
* **borders:** `border`, `border-top`, `border-left`, ... `border-0`, `border-top-0`, ...
* **border-radius:** `rounded`, `rounded-top`, ..., `rounded-0`
* **text alignment:** `text-left`, `text-center`, ...
* **text overflow:** `text-truncate`

### Colors

* **background:** `bg-primary`, `bg-seconday`, `bg-success`, `bg-light`, ..., `bg-white`, `bg-transparent`
* **text:** `text-primary`, ..., `text-white`, `text-black`, `text-muted`

### Responsive Classes

Many classes in Bootstrap have responsive variants that only take effect when reaching the given breakpoint.

For example, `m-2` provides 2 units of margin in all cases but `m-lg-2` provides 2 units of margin only once the viewport width has exceeded the "large" breakpoint (there's sm, md, and lg).

Generally, the syntax is `base`-`breakpoint`-`parameter`.

However, this section is informative because Lifelike is not responsive. The responsive classes do not work in the context of parent component sizes, so they are not applicable in our application.

## Standard Variables

### Document Colors

* `$body-bg`
* `$body-color`
* `$link-color`

### Color System

* `$white`
* `$black`
* `$gray-100` (lightest), `$gray-200`, ..., `$gray-900` (darkest)

### Theme Colors

* `$primary`
* `$secondary`
* `$success`
* `$info`
* `$warning`
* `$danger`
* `$light`
* `$dark`

### Sizing

* `$spacer` (currently 1rem)
* `$font-size-base`, `$font-size-lg`, `$font-size-sm`
* `$h1-font-size`, `$h2-font-size`, ...

### Styles

* `$border-radius`
* `$box-shadow`
