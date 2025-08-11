import { PrismaClient } from "../generated/prisma";
import { ErrorFactory } from "../middleware/error-handler";

// Create a singleton instance
let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
	if (!prismaInstance) {
		prismaInstance = new PrismaClient();
	}
	return prismaInstance;
}

// Allow setting a custom prisma instance for testing
export function setPrismaClient(client: PrismaClient): void {
	prismaInstance = client;
}

// Get the current prisma instance
const prisma = getPrismaClient();

// Business rule validation service
export class BusinessRuleValidator {
	/**
	 * Validate tour registration business rules
	 */
	static async validateTourRegistration(
		userId: string,
		tourEventId: string,
		userProviderId?: string
	): Promise<void> {
		// Get tour event details
		const tourEvent = await prisma.customTourEvent.findUnique({
			where: { tourEventId },
			include: {
				registrations: {
					where: { touristUserId: userId },
					select: { status: true },
				},
			},
		});

		if (!tourEvent) {
			throw ErrorFactory.resourceNotFound("Tour event", tourEventId);
		}

		// Check if tour event is active
		if (tourEvent.status !== "ACTIVE") {
			throw ErrorFactory.businessRuleViolation(
				"Cannot register for tour event that is not active"
			);
		}

		// Check capacity limits
		if (tourEvent.remainingTourists <= 0) {
			throw ErrorFactory.capacityLimitExceeded(
				"Tour event has reached maximum capacity"
			);
		}

		// Check if user already has an active registration for this tour
		const existingRegistration = tourEvent.registrations.find(
			(reg) => reg.status === "APPROVED" || reg.status === "PENDING"
		);

		if (existingRegistration) {
			throw ErrorFactory.registrationConflict(
				"User already has an active registration for this tour event"
			);
		}

		// Check for overlapping tour registrations in the same time period
		await this.validateOverlappingRegistrations(
			userId,
			tourEvent.startDate,
			tourEvent.endDate
		);

		// Validate data isolation - user must belong to same provider as tour event
		if (userProviderId && userProviderId !== tourEvent.providerId) {
			throw ErrorFactory.dataIsolationViolation(
				"User cannot register for tour events from different providers"
			);
		}
	}

	/**
	 * Validate that user doesn't have overlapping tour registrations
	 */
	static async validateOverlappingRegistrations(
		userId: string,
		startDate: Date,
		endDate: Date
	): Promise<void> {
		const overlappingRegistrations = await prisma.touristRegistration.findMany({
			where: {
				touristUserId: userId,
				status: {
					in: ["APPROVED", "PENDING"],
				},
				tourEvent: {
					OR: [
						{
							AND: [
								{ startDate: { lte: startDate } },
								{ endDate: { gte: startDate } },
							],
						},
						{
							AND: [
								{ startDate: { lte: endDate } },
								{ endDate: { gte: endDate } },
							],
						},
						{
							AND: [
								{ startDate: { gte: startDate } },
								{ endDate: { lte: endDate } },
							],
						},
					],
				},
			},
			include: {
				tourEvent: {
					select: {
						customTourName: true,
						startDate: true,
						endDate: true,
					},
				},
			},
		});

		if (overlappingRegistrations.length > 0) {
			const conflictingTour = overlappingRegistrations[0].tourEvent;
			throw ErrorFactory.registrationConflict(
				`User already has a registration for "${conflictingTour.customTourName}" ` +
					`from ${conflictingTour.startDate.toISOString().split("T")[0]} ` +
					`to ${conflictingTour.endDate.toISOString().split("T")[0]} ` +
					`which overlaps with the requested tour dates`
			);
		}
	}

	/**
	 * Validate provider-scoped operations
	 */
	static async validateProviderAccess(
		userProviderId: string | undefined,
		resourceProviderId: string,
		resourceType: string,
		operation: string = "access"
	): Promise<void> {
		// System administrators can access all resources
		if (!userProviderId) {
			return; // Assume system admin if no provider ID
		}

		// Provider administrators can only access their own provider's resources
		if (userProviderId !== resourceProviderId) {
			throw ErrorFactory.dataIsolationViolation(
				`Cannot ${operation} ${resourceType} from different provider. ` +
					`User provider: ${userProviderId}, Resource provider: ${resourceProviderId}`
			);
		}
	}

	/**
	 * Validate user access to provider-scoped resources
	 */
	static async validateUserProviderAccess(
		requestingUserId: string,
		targetUserId: string,
		operation: string = "access"
	): Promise<void> {
		const [requestingUser, targetUser] = await Promise.all([
			prisma.user.findUnique({
				where: { userId: requestingUserId },
				select: { userType: true, providerId: true },
			}),
			prisma.user.findUnique({
				where: { userId: targetUserId },
				select: { providerId: true },
			}),
		]);

		if (!requestingUser) {
			throw ErrorFactory.resourceNotFound("Requesting user", requestingUserId);
		}

		if (!targetUser) {
			throw ErrorFactory.resourceNotFound("Target user", targetUserId);
		}

		// System administrators can access all users
		if (requestingUser.userType === "SYSTEM_ADMIN") {
			return;
		}

		// Provider administrators can only access users from their provider
		if (requestingUser.userType === "PROVIDER_ADMIN") {
			if (requestingUser.providerId !== targetUser.providerId) {
				throw ErrorFactory.dataIsolationViolation(
					`Cannot ${operation} user from different provider`
				);
			}
			return;
		}

		// Tourists can only access their own profile
		if (requestingUserId !== targetUserId) {
			throw ErrorFactory.insufficientPermissions(
				`Tourists can only ${operation} their own profile`
			);
		}
	}

	/**
	 * Validate tour event capacity management
	 */
	static async validateCapacityUpdate(
		tourEventId: string,
		newCapacity: number
	): Promise<void> {
		const tourEvent = await prisma.customTourEvent.findUnique({
			where: { tourEventId },
			include: {
				registrations: {
					where: {
						status: "APPROVED",
					},
				},
			},
		});

		if (!tourEvent) {
			throw ErrorFactory.resourceNotFound("Tour event", tourEventId);
		}

		const approvedRegistrations = tourEvent.registrations.length;

		if (newCapacity < approvedRegistrations) {
			throw ErrorFactory.businessRuleViolation(
				`Cannot reduce capacity to ${newCapacity} as there are already ` +
					`${approvedRegistrations} approved registrations`
			);
		}
	}

	/**
	 * Validate activity scheduling conflicts
	 */
	static async validateActivityScheduling(
		tourEventId: string,
		activityDate: Date,
		startTime: string,
		endTime: string,
		excludeActivityId?: string
	): Promise<void> {
		const conflictingActivities = await prisma.activity.findMany({
			where: {
				tourEventId,
				activityDate,
				...(excludeActivityId && {
					activityId: { not: excludeActivityId },
				}),
				OR: [
					{
						AND: [
							{ startTime: { lte: startTime } },
							{ endTime: { gt: startTime } },
						],
					},
					{
						AND: [
							{ startTime: { lt: endTime } },
							{ endTime: { gte: endTime } },
						],
					},
					{
						AND: [
							{ startTime: { gte: startTime } },
							{ endTime: { lte: endTime } },
						],
					},
				],
			},
			select: {
				activityName: true,
				startTime: true,
				endTime: true,
			},
		});

		if (conflictingActivities.length > 0) {
			const conflict = conflictingActivities[0];
			throw ErrorFactory.businessRuleViolation(
				`Activity scheduling conflict detected with "${conflict.activityName}" ` +
					`(${conflict.startTime} - ${conflict.endTime})`
			);
		}
	}

	/**
	 * Validate document access permissions
	 */
	static async validateDocumentAccess(
		requestingUserId: string,
		documentId: string,
		operation: string = "access"
	): Promise<void> {
		const document = await prisma.document.findUnique({
			where: { documentId },
			include: {
				user: {
					select: {
						userId: true,
						providerId: true,
					},
				},
			},
		});

		if (!document) {
			throw ErrorFactory.resourceNotFound("Document", documentId);
		}

		const requestingUser = await prisma.user.findUnique({
			where: { userId: requestingUserId },
			select: {
				userType: true,
				providerId: true,
			},
		});

		if (!requestingUser) {
			throw ErrorFactory.resourceNotFound("Requesting user", requestingUserId);
		}

		// System administrators can access all documents
		if (requestingUser.userType === "SYSTEM_ADMIN") {
			return;
		}

		// Provider administrators can access documents from their provider's users
		if (requestingUser.userType === "PROVIDER_ADMIN") {
			if (requestingUser.providerId !== document.user.providerId) {
				throw ErrorFactory.dataIsolationViolation(
					`Cannot ${operation} document from user in different provider`
				);
			}
			return;
		}

		// Tourists can only access their own documents
		if (requestingUserId !== document.userId) {
			throw ErrorFactory.insufficientPermissions(
				`Cannot ${operation} document belonging to another user`
			);
		}
	}

	/**
	 * Validate tour template usage
	 */
	static async validateTourTemplateUsage(templateId: string): Promise<void> {
		const template = await prisma.tourTemplate.findUnique({
			where: { templateId },
			select: {
				templateId: true,
				templateName: true,
			},
		});

		if (!template) {
			throw ErrorFactory.resourceNotFound("Tour template", templateId);
		}

		// Check if template is being used by any active tour events
		const activeTourEvents = await prisma.customTourEvent.findMany({
			where: {
				templateId,
				status: {
					in: ["ACTIVE", "DRAFT"],
				},
			},
			select: {
				customTourName: true,
				status: true,
			},
		});

		if (activeTourEvents.length > 0) {
			const eventNames = activeTourEvents
				.map((event) => event.customTourName)
				.join(", ");
			throw ErrorFactory.businessRuleViolation(
				`Cannot modify or delete tour template "${template.templateName}" ` +
					`as it is being used by active tour events: ${eventNames}`
			);
		}
	}

	/**
	 * Validate user role changes
	 */
	static async validateUserRoleChange(
		userId: string,
		newUserType: string,
		newProviderId?: string
	): Promise<void> {
		const user = await prisma.user.findUnique({
			where: { userId },
			select: {
				userType: true,
				providerId: true,
			},
		});

		if (!user) {
			throw ErrorFactory.resourceNotFound("User", userId);
		}

		// Validate role transition rules
		if (user.userType === "SYSTEM_ADMIN" && newUserType !== "SYSTEM_ADMIN") {
			// Check if this is the last system admin
			const systemAdminCount = await prisma.user.count({
				where: {
					userType: "SYSTEM_ADMIN",
					status: "ACTIVE",
				},
			});

			if (systemAdminCount <= 1) {
				throw ErrorFactory.businessRuleViolation(
					"Cannot change role of the last active system administrator"
				);
			}
		}

		// Validate provider assignment for non-system admin roles
		if (newUserType !== "SYSTEM_ADMIN" && !newProviderId) {
			throw ErrorFactory.businessRuleViolation(
				"Provider ID is required for ProviderAdmin and Tourist roles"
			);
		}

		if (newUserType === "SYSTEM_ADMIN" && newProviderId) {
			throw ErrorFactory.businessRuleViolation(
				"System administrators cannot be assigned to a specific provider"
			);
		}
	}

	/**
	 * Validate provider deletion
	 */
	static async validateProviderDeletion(providerId: string): Promise<void> {
		// Check for active users
		const activeUsers = await prisma.user.count({
			where: {
				providerId,
				status: "ACTIVE",
			},
		});

		if (activeUsers > 0) {
			throw ErrorFactory.businessRuleViolation(
				`Cannot delete provider with ${activeUsers} active users. ` +
					"Please deactivate or reassign users first."
			);
		}

		// Check for active tour events
		const activeTourEvents = await prisma.customTourEvent.count({
			where: {
				providerId,
				status: {
					in: ["ACTIVE", "DRAFT"],
				},
			},
		});

		if (activeTourEvents > 0) {
			throw ErrorFactory.businessRuleViolation(
				`Cannot delete provider with ${activeTourEvents} active tour events. ` +
					"Please complete or cancel tour events first."
			);
		}
	}
}

export default BusinessRuleValidator;
