import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

// region ChatGPTUsageSchemas
// This should always correspond to the schema in appserver/neo4japp/schemas/chatgpt_usage.py
export enum ChatGPTUsageInterval {
  minute = 'minute',
  hour = 'hour',
  day = 'day',
  week = 'week',
  month = 'month',
  year = 'year',
}

interface ChatGPTUsageQuery {
  start: number; // Unix timestamp in s
  interval?: ChatGPTUsageInterval;
  end?: number; // Unix timestamp in s
}

export interface ChatGPTUsageRecord {
  start: number; // Unix timestamp in seconds
  value: number; // Total tokens used
  end?: number; // Unix timestamp in seconds
}

export interface ChatGPTUsageResponse {
  results: ChatGPTUsageRecord;
  query: ChatGPTUsageQuery;
}

// endregion

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class ChatgptUsageService {
  private readonly prefix = '/api/chatgpt-usage';

  constructor(private readonly http: HttpClient) {}

  getUsage(params: ChatGPTUsageQuery, userId?: number): Observable<ChatGPTUsageResponse> {
    return this.http.get<ChatGPTUsageResponse>(
      this.prefix + (userId ? `/${userId}` : ''),
      // @ts-ignore
      { params }
    );
  }
}
