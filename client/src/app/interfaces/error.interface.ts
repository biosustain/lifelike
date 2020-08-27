export interface ApiHttpError {
    name: string;
    message: string;
}

export interface ServerError {
    apiHttpError: ApiHttpError;
    detail: string;
}
