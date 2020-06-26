import { Component, OnDestroy, OnInit } from '@angular/core';

import { AccountService } from 'app/users/services/account.service';
import { AppUser, UserCreationRequest } from 'app/interfaces';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { BehaviorSubject, Subscription } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { UserCreateDialogComponent } from './user-create-dialog.component';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorHandler } from '../../shared/services/error-handler.service';

@Component({
  selector: 'app-users-view',
  templateUrl: 'user-browser.component.html',
})
export class UserBrowserComponent implements OnInit, OnDestroy {
  users: AppUser[];
  shownUsers: AppUser[] = [];
  filterQuery = '';
  loadTask: BackgroundTask<void, AppUser[]> = new BackgroundTask(() => this.accountService.listOfUsers());
  loadTaskSubscription: Subscription;
  selection = new SelectionModel<AppUser>(true, []);

  constructor(private readonly accountService: AccountService,
              private readonly modalService: NgbModal,
              private readonly progressDialog: ProgressDialog,
              private readonly snackBar: MatSnackBar,
              private readonly errorHandler: ErrorHandler) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: users}) => {
      this.users = users;
      this.updateFilter();
    });

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
        .pipe(this.errorHandler.create())
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
}
