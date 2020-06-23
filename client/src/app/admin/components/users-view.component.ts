import { Component, OnDestroy, OnInit } from '@angular/core';

import { AccountService } from 'app/users/services/account.service';
import { AppUser } from 'app/interfaces';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { Subscription } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { UserCreationDialogComponent } from './user-creation-dialog.component';

@Component({
  selector: 'app-users-view',
  templateUrl: 'users-view.component.html',
})
export class UsersViewComponent implements OnInit, OnDestroy {

  users: AppUser[];
  shownUsers: AppUser[] = [];
  filterQuery = '';
  loadTask: BackgroundTask<void, AppUser[]> = new BackgroundTask(() => this.accountService.listOfUsers());
  loadTaskSubscription: Subscription;
  selection = new SelectionModel<AppUser>(true, []);

  constructor(private readonly accountService: AccountService,
              private readonly modalService: NgbModal) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({
                                                                    result: users,
                                                                  }) => {
        this.users = users;
        this.updateFilter();
      },
    );

    this.updateDataSource();
  }

  ngOnDestroy(): void {
    this.loadTaskSubscription.unsubscribe();
  }

  updateDataSource() {
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

  applyFilter(query: string) {
    this.filterQuery = query.trim();
    this.updateFilter();
  }

  private updateFilter() {
    this.shownUsers = this.filterQuery.length ? this.users.filter(user => user.username.includes(this.filterQuery)) : this.users;
  }

  openCreateDialog() {
    const modalRef = this.modalService.open(UserCreationDialogComponent);
  }
}
