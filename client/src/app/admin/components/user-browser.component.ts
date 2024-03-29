import { Component, OnDestroy, OnInit } from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject, Subscription } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Store } from '@ngrx/store';

import { AccountService } from 'app/users/services/account.service';
import { AppUser, PrivateAppUser, UserUpdateData } from 'app/interfaces';
import { ResultList } from 'app/shared/schemas/common';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { AuthActions } from 'app/auth/store';
import { State } from 'app/root-store';
import { appUserLoadingMock } from 'app/shared/mocks/loading/user';
import { mockArrayOf } from 'app/shared/mocks/loading/utils';
import { AuthenticationService } from 'app/auth/services/authentication.service';

import { UserCreateDialogComponent } from './user-create-dialog.component';
import { UserUpdateDialogComponent } from './user-update-dialog.component';
import { MissingRolesDialogComponent } from './missing-roles-dialog.component';

@Component({
  selector: 'app-users-view',
  templateUrl: 'user-browser.component.html',
})
export class UserBrowserComponent implements OnInit, OnDestroy {
  currentUser: AppUser;
  users: AppUser[];
  shownUsers: AppUser[] = mockArrayOf(appUserLoadingMock);
  filterQuery = '';
  loadTask: BackgroundTask<void, ResultList<PrivateAppUser>> = new BackgroundTask(() =>
    this.accountService.getUsers()
  );
  loadTaskSubscription: Subscription;
  selection = new SelectionModel<AppUser>(true, []);

  constructor(
    private readonly accountService: AccountService,
    private readonly modalService: NgbModal,
    private readonly progressDialog: ProgressDialog,
    private readonly snackBar: MatSnackBar,
    private readonly errorHandler: ErrorHandler,
    private readonly store: Store<State>,
    private readonly authService: AuthenticationService
  ) {}

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({ result: data }) => {
      this.users = data.results;
      this.updateFilter();
    });
    this.authService.appUser$.subscribe((user) => (this.currentUser = user));
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
    this.shownUsers = this.filterQuery.length
      ? this.users.filter((user) => user.username.includes(this.filterQuery))
      : this.users;
  }

  getRolelessUsers(): AppUser[] {
    return this.shownUsers.filter((user) => {
      return user.roles.length === 0;
    });
  }

  displayCreateDialog() {
    const modalRef = this.modalService.open(UserCreateDialogComponent);
    modalRef.result.then(
      (newUser) => {
        const progressDialogRef = this.progressDialog.display({
          title: `Creating User`,
          progressObservables: [
            new BehaviorSubject<Progress>(
              new Progress({
                status: 'Creating user...',
              })
            ),
          ],
        });

        this.accountService
          .createUser(newUser)
          .pipe(this.errorHandler.create({ label: 'Create user' }))
          .subscribe(
            (user: AppUser) => {
              progressDialogRef.close();
              this.accountService.getUserList();
              this.refresh();
              this.snackBar.open(`User ${user.username} created!`, 'close', { duration: 5000 });
            },
            () => {
              progressDialogRef.close();
            }
          );
      },
      () => {}
    );
  }

  displayUpdateDialog() {
    for (const selectedUser of this.shownUsers.slice().reverse()) {
      if (this.selection.isSelected(selectedUser)) {
        const modalRef = this.modalService.open(UserUpdateDialogComponent);
        modalRef.componentInstance.isSelf = this.currentUser.hashId === selectedUser.hashId;
        modalRef.componentInstance.setUser(selectedUser);
        modalRef.result.then(
          (userUpdateData: UserUpdateData) => {
            const progressDialogRef = this.progressDialog.display({
              title: `Updating User`,
              progressObservables: [
                new BehaviorSubject<Progress>(
                  new Progress({
                    status: 'Updating user...',
                  })
                ),
              ],
            });
            this.accountService
              .updateUser(userUpdateData, selectedUser.hashId)
              .pipe(this.errorHandler.create({ label: 'Update user' }))
              .subscribe(
                () => {
                  progressDialogRef.close();
                  if (this.currentUser.hashId === selectedUser.hashId) {
                    this.store.dispatch(AuthActions.updateUserSuccess({ userUpdateData }));
                    this.currentUser = {
                      ...this.currentUser,
                      ...userUpdateData,
                    };
                  }
                  this.refresh();
                  this.snackBar.open(`User ${selectedUser.username} updated!`, 'close', {
                    duration: 5000,
                  });
                },
                () => {
                  progressDialogRef.close();
                }
              );
          },
          () => {}
        );
      }
    }
  }

  displayUnlockUserDialog(user: AppUser) {
    event.stopPropagation();
    if (confirm('Unlock user ' + user.username + '?')) {
      const progressDialogRef = this.progressDialog.display({
        title: `Unlocking User`,
        progressObservables: [
          new BehaviorSubject<Progress>(
            new Progress({
              status: 'Unlocking user...',
            })
          ),
        ],
      });
      this.accountService
        .unlockUser(user.hashId)
        .pipe(this.errorHandler.create({ label: 'Unlock user' }))
        .subscribe(
          () => {
            progressDialogRef.close();
            this.snackBar.open(`User unlocked!!`, 'close', { duration: 5000 });
            user.locked = false;
          },
          () => {
            progressDialogRef.close();
          }
        );
    }
  }

  displayMissingRolesDialog() {
    const users = this.getRolelessUsers();
    const modalRef = this.modalService.open(MissingRolesDialogComponent);
    modalRef.componentInstance.users = users;
    modalRef.result.then((isModified) => {
      if (isModified) {
        this.refresh();
      }
    });
  }
}
