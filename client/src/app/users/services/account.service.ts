import { Injectable, OnDestroy } from '@angular/core';
import {
    HttpClient,
    HttpHeaders,
} from '@angular/common/http';
import {
    AppUser,
    UserCreationRequest,
    UpdateUserRequest,
} from 'app/interfaces';
import { map, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from 'environments/environment';

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class AccountService implements OnDestroy {
    readonly accountApi = `${environment.apiUrl}/accounts`;

    private completedSubjectsSource = new Subject<boolean>();
    private userListSource = new BehaviorSubject<AppUser[]>([]);
    readonly userList = this.userListSource.asObservable().pipe(takeUntil(this.completedSubjectsSource));

    constructor(private http: HttpClient) {}

    /**
     * Create http options with authorization
     * header if boolean set to true
     * @param withJwt boolean representing whether to return the options with a jwt
     */
    createHttpOptions(withJwt = false) {
        if (withJwt) {
        return {
            headers: new HttpHeaders({
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem('access_jwt'),
            }),
        };
        } else {
        return {
            headers: new HttpHeaders({
            'Content-Type': 'application/json',
            }),
        };
        }
    }

    getUserList() {
        this.listOfUsers().subscribe((users: AppUser[]) => {
            this.userListSource.next(users);
        });
    }

    createUser(request: UserCreationRequest) {
        return this.http.post<{result: AppUser}>(
            `${this.accountApi}/`, request,
            this.createHttpOptions(true),
        ).pipe(map(resp => resp.result));
    }

    listOfUsers() {
        return this.http.get<{result: AppUser[]}>(
            `${this.accountApi}/`,
            this.createHttpOptions(true),
        ).pipe(map(resp => resp.result));
    }

    currentUser() {
        return this.http.get<{result: AppUser}>(
            `${this.accountApi}/user`,
            this.createHttpOptions(true),
        ).pipe(map(resp => resp.result));
    }

    updateUser(updateRequest: UpdateUserRequest) {
        return this.http.put<{result: AppUser}>(
            `${this.accountApi}/user`,
            updateRequest,
            this.createHttpOptions(true),
        ).pipe(map(resp => resp.result));
    }

    ngOnDestroy() {
        this.completedSubjectsSource.next(true);
    }
}
