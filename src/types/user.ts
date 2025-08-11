export enum UserType {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  PROVIDER_ADMIN = 'PROVIDER_ADMIN',
  TOURIST = 'TOURIST'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export interface User {
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
  country: string;
  passwordHash: string;
  userType: UserType;
  status: UserStatus;
  passportNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
  providerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
  country: string;
  password: string;
  userType: UserType;
  passportNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
  providerId?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phoneNumber?: string;
  country?: string;
  passportNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
  status?: UserStatus;
}