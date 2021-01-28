export interface AppUser {
  /**
   * @deprecated
   */
  id: number;
  hashId: string;
  /**
   * @deprecated
   */
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  /**
   * @deprecated
   */
  roles: string[];
}

export type User = Pick<AppUser, 'id' | 'username'>;

export interface UpdateUserRequest extends AppUser {
  password: string;
  newPassword: string;
}

export interface Credential {
  email: string;
  password: string;
}
