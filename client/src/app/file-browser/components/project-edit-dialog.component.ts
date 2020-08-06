import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { ProjectSpaceService, Collaborator, Project } from '../services/project-space.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormArray, FormGroup, FormControl } from '@angular/forms';
import { Subscription, combineLatest, Observable, of } from 'rxjs';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { MatSnackBar } from '@angular/material';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { isNullOrUndefined, isArray } from 'util';
import { HttpErrorResponse } from '@angular/common/http';
import { AppUser } from 'app/interfaces';
import { AccountService } from 'app/users/services/account.service';
import { startWith, map, filter, debounceTime, distinctUntilChanged, switchMap, flatMap } from 'rxjs/operators';


@Component({
  selector: 'app-edit-project-dialog',
  templateUrl: './project-edit-dialog.component.html',
  styleUrls: ['./project-edit-dialog.component.scss']
})
export class ProjectEditDialogComponent extends CommonFormDialogComponent implements OnInit, OnDestroy {
  loadTask: BackgroundTask<string, Collaborator[]> = new BackgroundTask(
    (projectName) => this.projSpace.getCollaborators(projectName)
  );

  loadTaskSubscription: Subscription;

  PROJECT: Project = null;

  @Input()
  set project(proj: Project) {
    this.PROJECT = proj;
    this.refresh();
  }

  get project() {
    return this.PROJECT;
  }

  userRoles = [{
      value: 'project-write',
      label: 'Write'
    }, {
      value: 'project-read',
      label: 'Read'
    }, {
      value: 'project-admin',
      label: 'Admin'
    }];

  userActions = [
    ...this.userRoles,
    {
    value: 'delete',
    label: 'Remove user'
    }
  ];

  /**
   * Manages existing and pending collabs
   */
  form: FormGroup = new FormGroup({
    username: new FormControl(),
    role: new FormControl('project-read'),
    currentCollabs: new FormArray([])
  });

  listOfUsers: string[] = [];
  userOptions: string[];

  get currentCollabs(): FormArray {
    return this.form.get('currentCollabs') as FormArray;
  }

  collabs: Collaborator[] = [];

  userCollab: Collaborator = null;

  collabFormSubscription: Subscription[] = [];

  formSubscription: Subscription;

  get amIAdmin(): boolean {
    if (isNullOrUndefined(this.userCollab)) { return false; }
    return this.userCollab.role === 'project-admin';
  }

  hasError = false;
  errorMsg = '';

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    private projSpace: ProjectSpaceService,
    private readonly snackBar: MatSnackBar,
    private auth: AuthenticationService,
    private acc: AccountService
  ) {
    super(modal, messageDialog);
  }

  ngOnInit() {
    this.form.get('username').valueChanges
      .pipe(
        // Make sure a value is being pushed
        startWith(''),
        filter(val => val.length >= 1),
        // make sure not submitting duplicate request
        distinctUntilChanged(),
        // 500 ms between each input refresh
        debounceTime(500),
        flatMap(val => this.acc.listOfUsers(val))
      ).subscribe(users => {
        if (isArray(users)) {
          this.userOptions = users.map(u => u.username);
        } else {
          this.userOptions = [(users as AppUser).username];
        }
      });

    this.formSubscription = this.form
      .valueChanges
      .subscribe(
        () => {
          this.hasError = false;
        }
      );

    this.loadTaskSubscription = this.loadTask.results$.subscribe(
      ({
        result: collabs
      }) => {
        const userId = this.auth.whoAmI();

        this.userCollab = collabs.filter(c => userId === c.id)[0];
        this.collabs = collabs.filter(c => userId !== c.id);

        const listOfFormGroups = collabs.filter(
          c => userId !== c.id
        ).map(
          (c: Collaborator, index: number) => new FormGroup({
            username: new FormControl(c.username),
            role: new FormControl(c.role),
            id: new FormControl(c.id)
          })
        );

        this.form.setControl(
          'currentCollabs',
          new FormArray(listOfFormGroups)
        );

        this.collabFormSubscription.forEach(
          (sub: Subscription) => sub.unsubscribe()
        );

        console.log(this.form);

        this.collabFormSubscription = listOfFormGroups.map(
          (fg: FormGroup) => {
            const sub = fg.valueChanges.subscribe(
              val => this.updateCollaborator(val)
            );
            return sub;
          }
        );
      }
    );
  }

  ngOnDestroy() {
    this.collabFormSubscription.map(
      (sub: Subscription) => sub.unsubscribe()
    );
    this.loadTaskSubscription.unsubscribe();
    this.formSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update(this.project.projectName);
  }

  getValue() {
    return null;
  }

  /**
   * Call API to add collaborator with specified privilege
   */
  addCollaborator() {
    const {
      username,
      role
    } = this.form.value;

    if (isNullOrUndefined(username) || username.length === 0) {
      this.hasError = true;
      this.errorMsg = 'Enter an username';
      return;
    }

    // check if that collab is already added
    if (this.collabs.filter(c => c.username === username).length) {
      this.hasError = true;
      this.errorMsg = 'This user is already added. You can modify their privilege below.';
      return;
    }

    this.projSpace.addCollaborator(
      this.project.projectName,
      username,
      role
    ).subscribe(resp => {
      this.snackBar.open('Collaborator added!.', null, {
        duration: 2000,
      });

      this.refresh();
      this.form.get('username').reset();

    }, (err: HttpErrorResponse) => {
      interface Error {
        apiHttpError: {
          message;
          name;
        };
      }
      const error: Error = err.error;

      if (err.status === 404) {
        this.hasError = true;
        this.errorMsg = 'User does not exist';
      } else if (error.apiHttpError.name === 'Unauthorized Action') {
        this.hasError = true;
        this.errorMsg = error.apiHttpError.message;
      }
    });
  }

  /**
   * Callback to execute collab api when ever
   * form privillege change is detected
   * @param value - represent user to add
   */
  updateCollaborator(value) {
    const {
      username,
      role,
      id
    } = value;

    // Check if the user privilege is the same to prevent
    // redundant change
    const curCollab = this.collabs.filter(c => c.id === id)[0];
    if (curCollab.role === role) {
      return;
    } else if (role === 'delete') {
      // Remove the user from the list
      this.projSpace.removeCollaborator(
        this.project.projectName,
        username
      ).subscribe(resp => {
        this.snackBar.open('Collaborator removed!.', null, {
          duration: 2000,
        });
        this.refresh();
      });
    } else {
      this.projSpace.editCollaborator(
        this.project.projectName,
        username,
        role
      ).subscribe(resp => {
        this.refresh();
        this.snackBar.open('Collaborator updated!.', null, {
          duration: 2000,
        });
      });
    }
  }
}
