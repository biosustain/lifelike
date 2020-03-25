import { Component, OnInit } from '@angular/core';

import { AdminService } from '../services/admin.service';
import { AppUser } from 'app/interfaces';

@Component({
    selector: 'app-view-users',
    templateUrl: 'view-users.component.html',
    styleUrls: ['./view-users.component.scss']
})
export class ViewUsersComponent implements OnInit {

    users: AppUser[];

    constructor(private adminService: AdminService) {}

    ngOnInit() {
        this.adminService.getUserList();
        this.adminService.userList.subscribe((users: AppUser[]) => this.users = users);
    }
}
