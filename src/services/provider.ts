import { PrismaClient } from '../generated/prisma';
import { CreateProviderInput, UpdateProviderInput, Provider } from '../types/provider';
import { UserType } from '../types/user';
import { createProviderSchema, updateProviderSchema, providerIdSchema, providerPaginationSchema } from '../validation/provider';

export class ProviderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new provider (System Admin only)
   */
  async createProvider(input: CreateProviderInput, requestingUserType: UserType): Promise<Provider> {
    // Only system admin can create providers
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to create providers');
    }

    // Validate input
    const { error, value } = createProviderSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Check if email already exists
    const existingProviderByEmail = await this.prisma.provider.findUnique({
      where: { emailAddress: input.emailAddress }
    });
    
    if (existingProviderByEmail) {
      throw new Error('Provider with this email address already exists');
    }

    // Check if corporate ID/Tax ID already exists
    const existingProviderByCorpId = await this.prisma.provider.findUnique({
      where: { corpIdTaxId: input.corpIdTaxId }
    });
    
    if (existingProviderByCorpId) {
      throw new Error('Provider with this Corporate ID/Tax ID already exists');
    }

    // Create provider
    const provider = await this.prisma.provider.create({
      data: {
        companyName: value.companyName,
        country: value.country,
        addressLine1: value.addressLine1,
        addressLine2: value.addressLine2 || null,
        city: value.city,
        stateRegion: value.stateRegion,
        companyDescription: value.companyDescription,
        phoneNumber: value.phoneNumber,
        emailAddress: value.emailAddress,
        corpIdTaxId: value.corpIdTaxId,
        isIsolatedInstance: value.isIsolatedInstance ?? true,
      }
    });

    return provider;
  }

  /**
   * Get provider by ID with role-based access control
   */
  async getProviderById(
    providerId: string, 
    requestingUserType: UserType, 
    requestingUserProviderId?: string
  ): Promise<Provider | null> {
    // Validate provider ID
    const { error } = providerIdSchema.validate(providerId);
    if (error) {
      throw new Error(`Invalid provider ID: ${error.details[0].message}`);
    }

    const provider = await this.prisma.provider.findUnique({
      where: { providerId }
    });

    if (!provider) {
      return null;
    }

    // Role-based access control
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      // System admin can access any provider
      return provider;
    } else if (requestingUserType === UserType.PROVIDER_ADMIN) {
      // Provider admin can only access their own provider
      if (provider.providerId === requestingUserProviderId) {
        return provider;
      }
    }
    // Tourists cannot access provider details directly

    throw new Error('Insufficient permissions to access this provider');
  }

  /**
   * Get all providers (System Admin only)
   */
  async getProviders(requestingUserType: UserType, limit: number = 50, offset: number = 0): Promise<Provider[]> {
    // Only system admin can list all providers
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to list providers');
    }

    const providers = await this.prisma.provider.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' }
    });

    return providers;
  }

  /**
   * Update provider with validation and access control
   */
  async updateProvider(
    providerId: string, 
    input: UpdateProviderInput, 
    requestingUserType: UserType, 
    requestingUserProviderId?: string
  ): Promise<Provider> {
    // Validate input
    const { error, value } = updateProviderSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Get existing provider and check permissions
    const existingProvider = await this.getProviderById(providerId, requestingUserType, requestingUserProviderId);
    if (!existingProvider) {
      throw new Error('Provider not found');
    }

    // Check for email uniqueness if email is being updated
    if (value.emailAddress && value.emailAddress !== existingProvider.emailAddress) {
      const existingProviderByEmail = await this.prisma.provider.findUnique({
        where: { emailAddress: value.emailAddress }
      });
      
      if (existingProviderByEmail) {
        throw new Error('Provider with this email address already exists');
      }
    }

    // Update provider
    const updatedProvider = await this.prisma.provider.update({
      where: { providerId },
      data: {
        companyName: value.companyName ?? existingProvider.companyName,
        country: value.country ?? existingProvider.country,
        addressLine1: value.addressLine1 ?? existingProvider.addressLine1,
        addressLine2: value.addressLine2 ?? existingProvider.addressLine2,
        city: value.city ?? existingProvider.city,
        stateRegion: value.stateRegion ?? existingProvider.stateRegion,
        companyDescription: value.companyDescription ?? existingProvider.companyDescription,
        phoneNumber: value.phoneNumber ?? existingProvider.phoneNumber,
        emailAddress: value.emailAddress ?? existingProvider.emailAddress,
        isIsolatedInstance: value.isIsolatedInstance ?? existingProvider.isIsolatedInstance,
      }
    });

    return updatedProvider;
  }

  /**
   * Get users belonging to a specific provider (Provider-scoped query)
   */
  async getProviderUsers(
    providerId: string, 
    requestingUserType: UserType, 
    requestingUserProviderId?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    // Validate provider ID
    const { error } = providerIdSchema.validate(providerId);
    if (error) {
      throw new Error(`Invalid provider ID: ${error.details[0].message}`);
    }

    // Role-based access control
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      // System admin can access users from any provider
    } else if (requestingUserType === UserType.PROVIDER_ADMIN) {
      // Provider admin can only access users from their own provider
      if (providerId !== requestingUserProviderId) {
        throw new Error('Insufficient permissions to access users from this provider');
      }
    } else {
      // Tourists cannot access provider user lists
      throw new Error('Insufficient permissions to access provider users');
    }

    // Verify provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { providerId }
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Get users for this provider (data isolation)
    const users = await this.prisma.user.findMany({
      where: { providerId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        emailAddress: true,
        phoneNumber: true,
        country: true,
        userType: true,
        status: true,
        passportNumber: true,
        dateOfBirth: true,
        gender: true,
        createdAt: true,
        updatedAt: true,
        // Exclude passwordHash for security
      }
    });

    return users;
  }

  /**
   * Utility method to validate provider-scoped access
   * This ensures data isolation between providers
   */
  async validateProviderAccess(
    resourceProviderId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<boolean> {
    // System admin has access to all providers
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      return true;
    }

    // Provider admin and tourist can only access their own provider's data
    if (requestingUserType === UserType.PROVIDER_ADMIN || requestingUserType === UserType.TOURIST) {
      return resourceProviderId === requestingUserProviderId;
    }

    return false;
  }

  /**
   * Get provider statistics (System Admin only)
   */
  async getProviderStats(providerId: string, requestingUserType: UserType): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalTourEvents: number;
    activeTourEvents: number;
  }> {
    // Only system admin can access provider statistics
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to access provider statistics');
    }

    // Validate provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { providerId }
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Get user statistics
    const totalUsers = await this.prisma.user.count({
      where: { providerId }
    });

    const activeUsers = await this.prisma.user.count({
      where: { 
        providerId,
        status: 'ACTIVE'
      }
    });

    // Get tour event statistics
    const totalTourEvents = await this.prisma.customTourEvent.count({
      where: { providerId }
    });

    // For now, we'll count all tour events as active since we haven't implemented status filtering yet
    const activeTourEvents = totalTourEvents;

    return {
      totalUsers,
      activeUsers,
      totalTourEvents,
      activeTourEvents
    };
  }

  /**
   * Provider-scoped query utility for tour events
   * Ensures data isolation by filtering tour events by provider
   */
  async getProviderTourEvents(
    providerId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    // Validate provider ID
    const { error: providerIdError } = providerIdSchema.validate(providerId);
    if (providerIdError) {
      throw new Error(`Invalid provider ID: ${providerIdError.details[0].message}`);
    }

    // Validate pagination parameters
    const { error: paginationError, value: paginationValue } = providerPaginationSchema.validate({ limit, offset });
    if (paginationError) {
      throw new Error(`Invalid pagination parameters: ${paginationError.details.map(d => d.message).join(', ')}`);
    }

    // Validate provider access
    const hasAccess = await this.validateProviderAccess(providerId, requestingUserType, requestingUserProviderId);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to access tour events for this provider');
    }

    // Verify provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { providerId }
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Get provider-scoped tour events (data isolation)
    const tourEvents = await this.prisma.customTourEvent.findMany({
      where: { providerId },
      take: paginationValue.limit,
      skip: paginationValue.offset,
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: {
            templateName: true,
            type: true
          }
        },
        registrations: {
          select: {
            registrationId: true,
            status: true,
            registrationDate: true,
            tourist: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
                emailAddress: true
              }
            }
          }
        }
      }
    });

    return tourEvents;
  }

  /**
   * Provider-scoped query utility for documents
   * Ensures data isolation by filtering documents by provider users
   */
  async getProviderDocuments(
    providerId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    // Validate provider ID
    const { error: providerIdError } = providerIdSchema.validate(providerId);
    if (providerIdError) {
      throw new Error(`Invalid provider ID: ${providerIdError.details[0].message}`);
    }

    // Validate pagination parameters
    const { error: paginationError, value: paginationValue } = providerPaginationSchema.validate({ limit, offset });
    if (paginationError) {
      throw new Error(`Invalid pagination parameters: ${paginationError.details.map(d => d.message).join(', ')}`);
    }

    // Validate provider access
    const hasAccess = await this.validateProviderAccess(providerId, requestingUserType, requestingUserProviderId);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to access documents for this provider');
    }

    // Verify provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { providerId }
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Get documents for users belonging to this provider (data isolation)
    const documents = await this.prisma.document.findMany({
      where: {
        user: {
          providerId: providerId
        }
      },
      take: paginationValue.limit,
      skip: paginationValue.offset,
      orderBy: { uploadDate: 'desc' },
      include: {
        user: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            emailAddress: true
          }
        }
      }
    });

    return documents;
  }

  /**
   * Delete provider (System Admin only)
   */
  async deleteProvider(providerId: string, requestingUserType: UserType): Promise<void> {
    // Only system admin can delete providers
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to delete providers');
    }

    // Validate provider ID
    const { error } = providerIdSchema.validate(providerId);
    if (error) {
      throw new Error(`Invalid provider ID: ${error.details[0].message}`);
    }

    // Check if provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { providerId }
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Check if provider has associated users
    const userCount = await this.prisma.user.count({
      where: { providerId }
    });

    if (userCount > 0) {
      throw new Error('Cannot delete provider with associated users. Please reassign or delete users first.');
    }

    // Check if provider has associated tour events
    const tourEventCount = await this.prisma.customTourEvent.count({
      where: { providerId }
    });

    if (tourEventCount > 0) {
      throw new Error('Cannot delete provider with associated tour events. Please delete tour events first.');
    }

    // Delete provider
    await this.prisma.provider.delete({
      where: { providerId }
    });
  }

  /**
   * Enhanced provider access validation with detailed logging
   * This method ensures strict data isolation between providers
   */
  async validateProviderAccessWithLogging(
    resourceProviderId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    operation: string = 'access'
  ): Promise<boolean> {
    // System admin has access to all providers
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      console.log(`[DATA_ISOLATION] System admin granted ${operation} to provider ${resourceProviderId}`);
      return true;
    }

    // Provider admin and tourist can only access their own provider's data
    if (requestingUserType === UserType.PROVIDER_ADMIN || requestingUserType === UserType.TOURIST) {
      const hasAccess = resourceProviderId === requestingUserProviderId;
      
      if (hasAccess) {
        console.log(`[DATA_ISOLATION] ${requestingUserType} granted ${operation} to own provider ${resourceProviderId}`);
      } else {
        console.warn(`[DATA_ISOLATION] ${requestingUserType} denied ${operation} to provider ${resourceProviderId} (owns ${requestingUserProviderId})`);
      }
      
      return hasAccess;
    }

    console.warn(`[DATA_ISOLATION] Unknown user type ${requestingUserType} denied ${operation} to provider ${resourceProviderId}`);
    return false;
  }

  /**
   * Utility to check if a provider instance is isolated
   * This supports the requirement for establishing data isolation
   */
  async isProviderIsolated(providerId: string): Promise<boolean> {
    const provider = await this.prisma.provider.findUnique({
      where: { providerId },
      select: { isIsolatedInstance: true }
    });

    return provider?.isIsolatedInstance ?? true;
  }

  /**
   * Utility to get all isolated providers (System Admin only)
   * Helps with managing data isolation across the system
   */
  async getIsolatedProviders(requestingUserType: UserType): Promise<Provider[]> {
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to list isolated providers');
    }

    const isolatedProviders = await this.prisma.provider.findMany({
      where: { isIsolatedInstance: true },
      orderBy: { createdAt: 'desc' }
    });

    return isolatedProviders;
  }

  /**
   * Utility to enforce provider isolation when creating resources
   * This ensures new resources are properly scoped to the provider
   */
  async enforceProviderIsolation<T extends { providerId: string }>(
    resourceData: T,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<T> {
    // System admin can create resources for any provider
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      return resourceData;
    }

    // Provider admin can only create resources for their own provider
    if (requestingUserType === UserType.PROVIDER_ADMIN) {
      if (resourceData.providerId !== requestingUserProviderId) {
        throw new Error('Cannot create resources for other providers - data isolation violation');
      }
      return resourceData;
    }

    // Tourists cannot create provider-scoped resources
    throw new Error('Insufficient permissions to create provider-scoped resources');
  }

  /**
   * Comprehensive data isolation validator for multi-resource operations
   * Ensures all resources in a batch operation belong to the same provider
   */
  async validateBatchProviderIsolation<T extends { providerId: string }>(
    resources: T[],
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<T[]> {
    if (resources.length === 0) {
      return resources;
    }

    // System admin can access resources from any provider
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      return resources;
    }

    // For provider admin and tourist, ensure all resources belong to their provider
    const invalidResources = resources.filter(resource => 
      resource.providerId !== requestingUserProviderId
    );

    if (invalidResources.length > 0) {
      throw new Error(`Data isolation violation: ${invalidResources.length} resources belong to other providers`);
    }

    return resources;
  }

  /**
   * Provider-scoped query builder utility
   * Automatically adds provider filtering to database queries
   */
  buildProviderScopedQuery(
    baseQuery: any,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): any {
    // System admin sees all data - no additional filtering needed
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      return baseQuery;
    }

    // Provider admin and tourist see only their provider's data
    if (requestingUserType === UserType.PROVIDER_ADMIN || requestingUserType === UserType.TOURIST) {
      if (!requestingUserProviderId) {
        throw new Error('Provider ID required for provider-scoped queries');
      }
      
      return {
        ...baseQuery,
        where: {
          ...baseQuery.where,
          providerId: requestingUserProviderId
        }
      };
    }

    throw new Error('Invalid user type for provider-scoped query');
  }

  /**
   * Audit trail for data isolation operations
   * Logs all provider access attempts for security monitoring
   */
  async auditProviderAccess(
    operation: string,
    resourceType: string,
    resourceId: string,
    requestingUserType: UserType,
    requestingUserId: string,
    requestingUserProviderId?: string,
    success: boolean = true
  ): Promise<void> {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      operation,
      resourceType,
      resourceId,
      requestingUserType,
      requestingUserId,
      requestingUserProviderId,
      success,
      isolationLevel: requestingUserType === UserType.SYSTEM_ADMIN ? 'GLOBAL' : 'PROVIDER_SCOPED'
    };

    // In a production environment, this would write to an audit log table
    // For now, we'll use console logging with structured data
    console.log(`[AUDIT_TRAIL] ${JSON.stringify(auditEntry)}`);
  }

  /**
   * Provider data isolation health check
   * Verifies that data isolation is properly maintained across the system
   */
  async performDataIsolationHealthCheck(): Promise<{
    providersWithIsolationEnabled: number;
    providersWithIsolationDisabled: number;
    usersWithoutProvider: number;
    tourEventsWithoutProvider: number;
    documentsFromUsersWithoutProvider: number;
    isolationIntegrityScore: number;
  }> {
    // Count providers by isolation status
    const providersWithIsolationEnabled = await this.prisma.provider.count({
      where: { isIsolatedInstance: true }
    });

    const providersWithIsolationDisabled = await this.prisma.provider.count({
      where: { isIsolatedInstance: false }
    });

    // Count users without provider assignment (potential isolation breach)
    const usersWithoutProvider = await this.prisma.user.count({
      where: { 
        providerId: null,
        userType: { not: UserType.SYSTEM_ADMIN } // System admins don't need provider assignment
      }
    });

    // Count tour events without provider assignment (isolation breach)
    const tourEventsWithoutProvider = await this.prisma.customTourEvent.count({
      where: { providerId: null }
    });

    // Count documents from users without provider assignment
    const documentsFromUsersWithoutProvider = await this.prisma.document.count({
      where: {
        user: {
          providerId: null,
          userType: { not: UserType.SYSTEM_ADMIN }
        }
      }
    });

    // Calculate isolation integrity score (0-100)
    const totalProviders = providersWithIsolationEnabled + providersWithIsolationDisabled;
    const isolationViolations = usersWithoutProvider + tourEventsWithoutProvider + documentsFromUsersWithoutProvider;
    const isolationIntegrityScore = totalProviders > 0 
      ? Math.max(0, 100 - (isolationViolations * 10)) // Each violation reduces score by 10 points
      : 100;

    return {
      providersWithIsolationEnabled,
      providersWithIsolationDisabled,
      usersWithoutProvider,
      tourEventsWithoutProvider,
      documentsFromUsersWithoutProvider,
      isolationIntegrityScore
    };
  }
}