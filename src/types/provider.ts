export interface Provider {
  providerId: string;
  companyName: string;
  country: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  companyDescription: string;
  phoneNumber: string;
  emailAddress: string;
  corpIdTaxId: string;
  isIsolatedInstance: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProviderInput {
  companyName: string;
  country: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  companyDescription: string;
  phoneNumber: string;
  emailAddress: string;
  corpIdTaxId: string;
  isIsolatedInstance?: boolean;
}

export interface UpdateProviderInput {
  companyName?: string;
  country?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateRegion?: string;
  companyDescription?: string;
  phoneNumber?: string;
  emailAddress?: string;
  isIsolatedInstance?: boolean;
}