// Common types and interfaces will be defined here

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
  };
}

export type UserRole = 'SystemAdmin' | 'ProviderAdmin' | 'Tourist';
export type UserStatus = 'Active' | 'Inactive';
export type DocumentType = 'Passport' | 'Ticket' | 'TourForm' | 'Other';
export type TourEventStatus = 'Draft' | 'Active' | 'Full' | 'Completed' | 'Cancelled';