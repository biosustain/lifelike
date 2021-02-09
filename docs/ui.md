# Lifelike Design Guide

## Code Guidelines

* In returned observables, do NOT catch the error.

## General Guidelines

* Consider viewport sizes: 
* Consider super long user-inputted text, like names of projects or files. Should it wrap or should it be truncated with ellipsis?
* Touch-based input:
  * Bigger controls

## Common Widgets

### Tables and Listings

* Progress:
  * When 

## Elements

### Buttons

* Use **Title Case** for all buttons.
* If there is a *main* action (like uploading a file when you are on a list of files), use `btn-primary`.
* Most buttons should be `btn-outline-secondary` or `btn-secondary` depending on which looks better, but prefer the outline version.
* Do not use `btn-warning` or `btn-danger` unless it's also the primary action (reason: to reduce the color noise). An example where it would be appropriate would be a deletion confirmation dialog, where the main action is also the delete button.

## Modals

```typescript
class YourComponent {
  constructor(private modalService: NgbModal) {
  }
}
```

```typescript
export class NgbdModalContent {
  @Input() name;

  constructor(public activeModal: NgbActiveModal) {}
}
```

```html
  <div class="modal-header">
    <h4 class="modal-title" id="modal-basic-title">Title</h4>
    <button type="button" class="close" aria-label="Close" (click)="modal.dismiss('Cross click')">
      <span aria-hidden="true">&times;</span>
    </button>
  </div>
  <div class="modal-body">
    <form>
      <div class="form-group">
        <label for="dateOfBirth">Date of birth</label>
        <div class="input-group">
          <input id="dateOfBirth" class="form-control" placeholder="yyyy-mm-dd" name="dp" ngbDatepicker #dp="ngbDatepicker">
          <div class="input-group-append">
            <button class="btn btn-outline-secondary calendar" (click)="dp.toggle()" type="button"></button>
          </div>
        </div>
      </div>
    </form>
  </div>
  <div class="modal-footer">
    <button type="button" class="btn btn-outline-dark" (click)="modal.close('Save click')">Save</button>
  </div>
```
