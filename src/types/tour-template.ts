export enum SiteCategory {
  HISTORICAL = 'HISTORICAL',
  RELIGIOUS = 'RELIGIOUS',
  CULTURAL = 'CULTURAL',
  NATURAL = 'NATURAL',
  ENTERTAINMENT = 'ENTERTAINMENT',
  SHOPPING = 'SHOPPING',
  RESTAURANT = 'RESTAURANT',
  ACCOMMODATION = 'ACCOMMODATION',
  TRANSPORTATION = 'TRANSPORTATION',
  OTHER = 'OTHER'
}

export interface SiteToVisit {
  siteId: string;
  templateId: string;
  siteName: string;
  description?: string;
  location: string;
  visitDuration: string;
  estimatedCost?: number;
  category: SiteCategory;
  isOptional: boolean;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TourTemplate {
  templateId: string;
  templateName: string;
  type: string;
  year: number;
  startDate: Date;
  endDate: Date;
  detailedDescription: string;
  createdAt: Date;
  updatedAt: Date;
  sitesToVisit?: SiteToVisit[];
}

export interface CreateTourTemplateInput {
  templateName: string;
  type: string;
  year: number;
  startDate: Date;
  endDate: Date;
  detailedDescription: string;
  sitesToVisit?: CreateSiteToVisitInput[];
}

export interface CreateSiteToVisitInput {
  siteName: string;
  description?: string;
  location: string;
  visitDuration: string;
  estimatedCost?: number;
  category: SiteCategory;
  isOptional?: boolean;
  orderIndex: number;
}

export interface UpdateTourTemplateInput {
  templateName?: string;
  type?: string;
  year?: number;
  startDate?: Date;
  endDate?: Date;
  detailedDescription?: string;
}

export interface UpdateSiteToVisitInput {
  siteName?: string;
  description?: string;
  location?: string;
  visitDuration?: string;
  estimatedCost?: number;
  category?: SiteCategory;
  isOptional?: boolean;
  orderIndex?: number;
}