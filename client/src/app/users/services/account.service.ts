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

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class AccountService implements OnDestroy {
    readonly accountApi = '/api/accounts';

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

    /**
     * Write cookie to system
     * @param name - represent id name of cookie
     * @param value - value for cookie to store
     * @param days - how long should cookie exist
     */
    setCookie(name, value, days= 30) {
        let expires = '';
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + (value || '')  + expires + '; path=/';
    }
    getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') { c = c.substring(1,c.length); }
            if (c.indexOf(nameEQ) === 0) { return c.substring(nameEQ.length, c.length); }
        }
        return null;
    }
    eraseCookie(name) {
        document.cookie = name + '=; Max-Age=-99999999;';
    }
}
