export interface ApiHttpError {
    name: string;
    message: string;
}

export interface ServerError {
    apiHttpError: ApiHttpError;
    detail: string;
}


export interface ErrorLogMeta {
    label: string;
    expected?: boolean;
    url?: string;
}

export interface ErrorLog extends ErrorLogMeta {
    title: string;
    message: string;
    detail?: string;
    transactionId: string;
}
