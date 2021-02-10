import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate } from '@angular/router';
import { AccountService } from 'app/users/services/account.service';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AppUser } from 'app/interfaces';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly accountService: AccountService,
              public readonly snackBar: MatSnackBar) {
  }

  canActivate(routeSnapshot: ActivatedRouteSnapshot): Observable<boolean> {
    return this.accountService.currentUser().pipe(
      map((user: AppUser) => {
        const isAdmin = user.roles.includes('admin');
        if (!isAdmin) {
          this.openSnackBar('Unauthorized', 'close');
        }
        return isAdmin;
      }),
      take(1),
    );
  }

  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {duration: 5000});
  }
}
