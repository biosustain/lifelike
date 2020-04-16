import { Component, OnInit } from '@angular/core';

import { AccountService } from 'app/users/services/account.service';
import { AppUser } from 'app/interfaces';

@Component({
    selector: 'app-view-users',
    templateUrl: 'view-users.component.html',
    styleUrls: ['./view-users.component.scss']
})
export class ViewUsersComponent implements OnInit {

    users: AppUser[];

    constructor(private accountService: AccountService) {}

    ngOnInit() {
        this.accountService.getUserList();
        this.accountService.userList.subscribe((users: AppUser[]) => this.users = users);
    }
}
