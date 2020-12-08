import { AppUser } from '../interfaces';

// ========================================
// Locks
// ========================================

export interface ObjectLockData {
  user: AppUser;
  acquireDate: string;
}
