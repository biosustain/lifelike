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

export interface JWTToken {
    sub: string;
    iat: string;
    exp: string;
    tokenType: string;
    token: string;
}

export interface LoginResp {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
}

export interface JWTTokenResponse {
    accessToken: JWTToken;
    refreshToken: JWTToken;
    user: LoginResp;
}
