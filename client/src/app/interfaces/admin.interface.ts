export interface UserCreationRequest {
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    email: string;
    roles: string[];
}

export interface UserUpdateRequest {
  hashId: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface UserResetPasswordRequest {
  email: string;
}


