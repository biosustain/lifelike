import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppUser, UserCreationRequest } from 'app/interfaces';
import { map, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';


@Injectable({providedIn: 'root'})
export class AdminService implements OnDestroy {
    readonly adminApi = '/api/accounts';

    private completedSubjectsSource = new Subject<boolean>();
    private userListSource = new BehaviorSubject<AppUser[]>([]);
    readonly userList = this.userListSource.asObservable().pipe(takeUntil(this.completedSubjectsSource));

    constructor(private http: HttpClient) {}

    getUserList() {
        this.listOfUsers().subscribe((users: AppUser[]) => {
            this.userListSource.next(users);
        });
    }

    createUser(request: UserCreationRequest) {
        return this.http.post<{result: AppUser}>(
            `${this.adminApi}/`, request,
        ).pipe(map(resp => resp.result));
    }

    listOfUsers() {
        return this.http.get<{result: AppUser[]}>(
            `${this.adminApi}/`,
        ).pipe(map(resp => resp.result));
    }

    currentUser() {
        return this.http.get<{result: AppUser}>(
            `${this.adminApi}/user`
        ).pipe(map(resp => resp.result));
    }

    ngOnDestroy() {
        this.completedSubjectsSource.next(true);
    }
}
