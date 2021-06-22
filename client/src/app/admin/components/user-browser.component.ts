import { Component, OnDestroy, OnInit } from '@angular/core';

import { AccountService } from 'app/users/services/account.service';
import { AppUser, PrivateAppUser, UserCreationRequest } from 'app/interfaces';
import { ResultList } from 'app/shared/schemas/common';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { BehaviorSubject, Subscription } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { UserCreateDialogComponent } from './user-create-dialog.component';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { UserUpdateDialogComponent } from './user-update-dialog.component';
import { AuthActions, AuthSelectors } from '../../auth/store';
import { select, Store } from '@ngrx/store';
import { State } from '../../root-store';


@Component({
  selector: 'app-users-view',
  templateUrl: 'user-browser.component.html',
})
export class UserBrowserComponent implements OnInit, OnDestroy {
  currentUser: AppUser;
  users: AppUser[];
  shownUsers: AppUser[] = [];
  filterQuery = '';
  loadTask: BackgroundTask<void, ResultList<PrivateAppUser>> = new BackgroundTask(() => this.accountService.getUsers());
  loadTaskSubscription: Subscription;
  selection = new SelectionModel<AppUser>(true, []);

  constructor(private readonly accountService: AccountService,
              private readonly modalService: NgbModal,
              private readonly progressDialog: ProgressDialog,
              private readonly snackBar: MatSnackBar,
              private readonly errorHandler: ErrorHandler,
              private store: Store<State> ) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: data}) => {
      this.users = data.results;
      this.updateFilter();
    });
    this.store.pipe(select(AuthSelectors.selectAuthUser)).subscribe(user => this.currentUser = user);
    this.refresh();
  }

  ngOnDestroy(): void {
    this.loadTaskSubscription.unsubscribe();
  }

  refresh() {
    this.selection.clear();
    this.loadTask.update();
  }

  isAllSelected(): boolean {
    if (!this.selection.selected.length) {
      return false;
    }
    for (const item of this.shownUsers) {
      if (!this.selection.isSelected(item)) {
        return false;
      }
    }
    return true;
  }

  isOneSelected(): boolean {
    if (!this.selection.selected.length) {
      return false;
    }
    for (const item of this.shownUsers) {
      if (this.selection.isSelected(item)) {
        return true;
      }
    }
    return false;
  }

  toggleAllSelected(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.shownUsers);
    }
  }

  private updateFilter() {
    this.shownUsers = this.filterQuery.length ? this.users.filter(user => user.username.includes(this.filterQuery)) : this.users;
  }

  displayCreateDialog() {
    const modalRef = this.modalService.open(UserCreateDialogComponent);
    modalRef.result.then(newUser => {
      const progressDialogRef = this.progressDialog.display({
        title: `Creating User`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Creating user...',
        })),
      });

      this.accountService.createUser(newUser)
        .pipe(this.errorHandler.create({label: 'Create user'}))
        .subscribe((user: AppUser) => {
          progressDialogRef.close();
          this.accountService.getUserList();
          this.refresh();
          this.snackBar.open(
            `User ${user.username} created!`,
            'close',
            {duration: 5000},
          );
        }, () => {
          progressDialogRef.close();
        });
    }, () => {
    });
  }


  displayUpdateDialog() {
    for (const selectedUser of this.shownUsers.reverse()) {
      if (this.selection.isSelected(selectedUser)) {
        const modalRef = this.modalService.open(UserUpdateDialogComponent);
        modalRef.componentInstance.setUser(selectedUser);
        modalRef.result.then(updatedUser => {
          const progressDialogRef = this.progressDialog.display({
            title: `Updating User`,
            progressObservable: new BehaviorSubject<Progress>(new Progress({
              status: 'Updating user...',
            })),
          });
          // Data object containing one key (hash_id) -> no update data provided
          if (Object.keys(updatedUser).length === 1) {
            progressDialogRef.close();
            this.snackBar.open(
                `Provided data is either empty of unmodified!`,
                'close',
                {duration: 5000},
              );
          } else {
            this.accountService.updateUser(updatedUser)
            .pipe(this.errorHandler.create({label: 'Update user'}))
            .subscribe(() => {
              progressDialogRef.close();
              if (this.currentUser.hashId === selectedUser.hashId) {
                  updatedUser = {...this.currentUser, ...updatedUser};
                  this.store.dispatch(AuthActions.userUpdated(
                      {user: updatedUser},
                    ));
                  this.currentUser = updatedUser;
              }
              this.refresh();
              this.snackBar.open(
                `User ${selectedUser.username} updated!`,
                'close',
                {duration: 5000},
              );
            }, () => {
              progressDialogRef.close();
            });
          }
        }, () => {
        });
      }
    }
  }

  displayUnlockUserDialog(user: AppUser) {
    event.stopPropagation();
    if (confirm('Unlock user ' + user.username + '?')) {
      const progressDialogRef = this.progressDialog.display({
        title: `Unlocking User`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Unlocking user...',
        })),
      });
      this.accountService.unlockUser(user.hashId)
        .pipe(this.errorHandler.create({label: 'Unlock user'}))
        .subscribe(() => {
          progressDialogRef.close();
          this.snackBar.open(
            `User unlocked!!`,
            'close',
            {duration: 5000},
          );
          user.locked = false;
        }, () => {
          progressDialogRef.close();
        });
    }
  }
}
