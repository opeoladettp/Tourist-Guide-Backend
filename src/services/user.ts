import { PrismaClient } from "../generated/prisma";
import {
	CreateUserInput,
	UpdateUserInput,
	User,
	UserType,
	UserStatus,
} from "../types/user";
import {
	hashPassword,
	verifyPassword,
	validatePasswordStrength,
} from "../utils/password";
import {
	createUserSchema,
	updateUserSchema,
	userIdSchema,
} from "../validation/user";

// Helper function to convert Prisma user to User interface
function convertPrismaUserToUser(prismaUser: any): User {
	return {
		...prismaUser,
		middleName: prismaUser.middleName || undefined,
		userType: prismaUser.userType as UserType,
		status: prismaUser.status as UserStatus,
		providerId: prismaUser.providerId || undefined,
		passportNumber: prismaUser.passportNumber || undefined,
		dateOfBirth: prismaUser.dateOfBirth || undefined,
		gender: prismaUser.gender || undefined,
	};
}

export class UserService {
	constructor(private prisma: PrismaClient) {}

	/**
	 * Create a new user with password hashing and validation
	 */
	async createUser(input: CreateUserInput): Promise<User> {
		// Validate input
		const { error, value } = createUserSchema.validate(input);
		if (error) {
			throw new Error(
				`Validation error: ${error.details.map((d) => d.message).join(", ")}`
			);
		}

		// Validate password strength
		const passwordValidation = validatePasswordStrength(input.password);
		if (!passwordValidation.isValid) {
			throw new Error(
				`Password validation failed: ${passwordValidation.errors.join(", ")}`
			);
		}

		// Check if email already exists
		const existingUser = await this.prisma.user.findUnique({
			where: { emailAddress: input.emailAddress },
		});

		if (existingUser) {
			throw new Error("User with this email address already exists");
		}

		// Validate provider exists if providerId is provided
		if (input.providerId) {
			const provider = await this.prisma.provider.findUnique({
				where: { providerId: input.providerId },
			});

			if (!provider) {
				throw new Error("Provider not found");
			}
		}

		// Hash password
		const passwordHash = await hashPassword(input.password);

		// Create user
		const user = await this.prisma.user.create({
			data: {
				firstName: value.firstName,
				middleName: value.middleName || null,
				lastName: value.lastName,
				emailAddress: value.emailAddress,
				phoneNumber: value.phoneNumber,
				country: value.country,
				passwordHash,
				userType: value.userType,
				passportNumber: value.passportNumber || null,
				dateOfBirth: value.dateOfBirth || null,
				gender: value.gender || null,
				providerId: value.providerId || null,
			},
		});

		return convertPrismaUserToUser(user);
	}

	/**
	 * Get user by ID with role-based access control
	 */
	async getUserById(
		userId: string,
		requestingUserId: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string
	): Promise<User | null> {
		// Validate user ID
		const { error } = userIdSchema.validate(userId);
		if (error) {
			throw new Error(`Invalid user ID: ${error.details[0].message}`);
		}

		const user = await this.prisma.user.findUnique({
			where: { userId },
		});

		if (!user) {
			return null;
		}

		// Role-based access control
		if (requestingUserType === UserType.SYSTEM_ADMIN) {
			// System admin can access any user
			return convertPrismaUserToUser(user);
		} else if (requestingUserType === UserType.PROVIDER_ADMIN) {
			// Provider admin can access users in their company or themselves
			if (
				user.providerId === requestingUserProviderId ||
				user.userId === requestingUserId
			) {
				return convertPrismaUserToUser(user);
			}
		} else if (requestingUserType === UserType.TOURIST) {
			// Tourist can only access their own profile
			if (user.userId === requestingUserId) {
				return convertPrismaUserToUser(user);
			}
		}

		throw new Error("Insufficient permissions to access this user");
	}

	/**
	 * Update user with validation
	 */
	async updateUser(
		userId: string,
		input: UpdateUserInput,
		requestingUserId: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string
	): Promise<User> {
		// Validate input
		const { error, value } = updateUserSchema.validate(input);
		if (error) {
			throw new Error(
				`Validation error: ${error.details.map((d) => d.message).join(", ")}`
			);
		}

		// Get existing user and check permissions
		const existingUser = await this.getUserById(
			userId,
			requestingUserId,
			requestingUserType,
			requestingUserProviderId
		);
		if (!existingUser) {
			throw new Error("User not found");
		}

		// Additional permission check for status updates (only admins can change status)
		if (value.status && requestingUserType === UserType.TOURIST) {
			throw new Error("Insufficient permissions to update user status");
		}

		// Update user
		const updatedUser = await this.prisma.user.update({
			where: { userId },
			data: {
				firstName: value.firstName ?? existingUser.firstName,
				middleName: value.middleName ?? existingUser.middleName,
				lastName: value.lastName ?? existingUser.lastName,
				phoneNumber: value.phoneNumber ?? existingUser.phoneNumber,
				country: value.country ?? existingUser.country,
				passportNumber: value.passportNumber ?? existingUser.passportNumber,
				dateOfBirth: value.dateOfBirth ?? existingUser.dateOfBirth,
				gender: value.gender ?? existingUser.gender,
				status: value.status ?? existingUser.status,
			},
		});

		return convertPrismaUserToUser(updatedUser);
	}

	/**
	 * Get users with provider-scoped filtering
	 */
	async getUsers(
		requestingUserType: UserType,
		requestingUserProviderId?: string,
		limit: number = 50,
		offset: number = 0
	): Promise<User[]> {
		let whereClause = {};

		if (
			requestingUserType === UserType.PROVIDER_ADMIN &&
			requestingUserProviderId
		) {
			// Provider admin can only see users in their company
			whereClause = { providerId: requestingUserProviderId };
		} else if (requestingUserType === UserType.TOURIST) {
			// Tourists cannot list other users
			throw new Error("Insufficient permissions to list users");
		}
		// System admin can see all users (no where clause)

		const users = await this.prisma.user.findMany({
			where: whereClause,
			take: limit,
			skip: offset,
			orderBy: { createdAt: "desc" },
		});

		return users.map(convertPrismaUserToUser);
	}

	/**
	 * Verify user credentials for authentication
	 */
	async verifyCredentials(
		emailAddress: string,
		password: string
	): Promise<User | null> {
		const user = await this.prisma.user.findUnique({
			where: { emailAddress },
		});

		if (!user) {
			return null;
		}

		const isValidPassword = await verifyPassword(password, user.passwordHash);
		if (!isValidPassword) {
			return null;
		}

		return convertPrismaUserToUser(user);
	}

	/**
	 * Delete user with role-based access control
	 */
	async deleteUser(
		userId: string,
		requestingUserId: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string
	): Promise<void> {
		// Get existing user and check permissions
		const existingUser = await this.getUserById(
			userId,
			requestingUserId,
			requestingUserType,
			requestingUserProviderId
		);
		if (!existingUser) {
			throw new Error("User not found");
		}

		// Only system admin or provider admin can delete users
		if (requestingUserType === UserType.TOURIST) {
			throw new Error("Insufficient permissions to delete users");
		}

		// Provider admin can only delete users in their company (except themselves)
		if (requestingUserType === UserType.PROVIDER_ADMIN) {
			if (
				existingUser.providerId !== requestingUserProviderId ||
				existingUser.userId === requestingUserId
			) {
				throw new Error("Cannot delete this user");
			}
		}

		await this.prisma.user.delete({
			where: { userId },
		});
	}

	/**
	 * Associate user with provider (Provider Admin capability)
	 */
	async associateUserWithProvider(
		userId: string,
		providerId: string,
		requestingUserId: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string
	): Promise<User> {
		// Only system admin or provider admin can associate users with providers
		if (requestingUserType === UserType.TOURIST) {
			throw new Error(
				"Insufficient permissions to associate users with providers"
			);
		}

		// Provider admin can only associate users with their own provider
		if (requestingUserType === UserType.PROVIDER_ADMIN) {
			if (providerId !== requestingUserProviderId) {
				throw new Error(
					"Provider admin can only associate users with their own provider"
				);
			}
		}

		// Validate that the provider exists
		const provider = await this.prisma.provider.findUnique({
			where: { providerId },
		});

		if (!provider) {
			throw new Error("Provider not found");
		}

		// Get the user to be associated
		const user = await this.prisma.user.findUnique({
			where: { userId },
		});

		if (!user) {
			throw new Error("User not found");
		}

		// Check if user is already associated with a provider
		if (user.providerId && user.providerId !== providerId) {
			throw new Error("User is already associated with another provider");
		}

		// Update user's provider association
		const updatedUser = await this.prisma.user.update({
			where: { userId },
			data: { providerId },
		});

		return convertPrismaUserToUser(updatedUser);
	}

	/**
	 * Remove user from provider (Provider Admin capability)
	 */
	async removeUserFromProvider(
		userId: string,
		requestingUserId: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string
	): Promise<User> {
		// Only system admin or provider admin can remove users from providers
		if (requestingUserType === UserType.TOURIST) {
			throw new Error(
				"Insufficient permissions to remove users from providers"
			);
		}

		// Get the user to be removed
		const user = await this.prisma.user.findUnique({
			where: { userId },
		});

		if (!user) {
			throw new Error("User not found");
		}

		// Provider admin can only remove users from their own provider
		if (requestingUserType === UserType.PROVIDER_ADMIN) {
			if (user.providerId !== requestingUserProviderId) {
				throw new Error(
					"Provider admin can only remove users from their own provider"
				);
			}

			// Provider admin cannot remove themselves
			if (user.userId === requestingUserId) {
				throw new Error(
					"Provider admin cannot remove themselves from the provider"
				);
			}
		}

		// Remove user's provider association
		const updatedUser = await this.prisma.user.update({
			where: { userId },
			data: { providerId: null },
		});

		return convertPrismaUserToUser(updatedUser);
	}

	/**
	 * Create user within provider context (Provider Admin capability)
	 */
	async createProviderUser(
		input: CreateUserInput,
		requestingUserId: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string
	): Promise<User> {
		// Only system admin or provider admin can create users within provider context
		if (requestingUserType === UserType.TOURIST) {
			throw new Error("Insufficient permissions to create users");
		}

		// Provider admin can only create users for their own provider
		if (requestingUserType === UserType.PROVIDER_ADMIN) {
			if (!requestingUserProviderId) {
				throw new Error("Provider admin must have a provider association");
			}

			// Force the new user to be associated with the provider admin's provider
			input.providerId = requestingUserProviderId;

			// Provider admin cannot create system admin users
			if (input.userType === UserType.SYSTEM_ADMIN) {
				throw new Error(
					"Provider admin cannot create system administrator users"
				);
			}

			// Provider admin cannot create other provider admin users
			if (input.userType === UserType.PROVIDER_ADMIN) {
				throw new Error(
					"Provider admin cannot create other provider administrator users"
				);
			}
		}

		// Create the user using the existing createUser method
		return await this.createUser(input);
	}

	/**
	 * Get provider-scoped user statistics (Provider Admin capability)
	 */
	async getProviderUserStats(
		providerId: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string
	): Promise<{
		totalUsers: number;
		activeUsers: number;
		inactiveUsers: number;
		touristUsers: number;
		providerAdminUsers: number;
	}> {
		// Only system admin or provider admin can get user statistics
		if (requestingUserType === UserType.TOURIST) {
			throw new Error("Insufficient permissions to access user statistics");
		}

		// Provider admin can only get statistics for their own provider
		if (requestingUserType === UserType.PROVIDER_ADMIN) {
			if (providerId !== requestingUserProviderId) {
				throw new Error(
					"Provider admin can only access statistics for their own provider"
				);
			}
		}

		// Validate that the provider exists
		const provider = await this.prisma.provider.findUnique({
			where: { providerId },
		});

		if (!provider) {
			throw new Error("Provider not found");
		}

		// Get user statistics for the provider
		const totalUsers = await this.prisma.user.count({
			where: { providerId },
		});

		const activeUsers = await this.prisma.user.count({
			where: {
				providerId,
				status: "ACTIVE",
			},
		});

		const inactiveUsers = await this.prisma.user.count({
			where: {
				providerId,
				status: "INACTIVE",
			},
		});

		const touristUsers = await this.prisma.user.count({
			where: {
				providerId,
				userType: UserType.TOURIST,
			},
		});

		const providerAdminUsers = await this.prisma.user.count({
			where: {
				providerId,
				userType: UserType.PROVIDER_ADMIN,
			},
		});

		return {
			totalUsers,
			activeUsers,
			inactiveUsers,
			touristUsers,
			providerAdminUsers,
		};
	}

	/**
	 * Bulk update user status within provider (Provider Admin capability)
	 */
	async bulkUpdateProviderUserStatus(
		userIds: string[],
		status: "ACTIVE" | "INACTIVE",
		requestingUserId: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string
	): Promise<{ updated: number; failed: string[] }> {
		// Only system admin or provider admin can bulk update user status
		if (requestingUserType === UserType.TOURIST) {
			throw new Error("Insufficient permissions to bulk update user status");
		}

		const failed: string[] = [];
		let updated = 0;

		for (const userId of userIds) {
			try {
				// Get the user to validate provider association
				const user = await this.prisma.user.findUnique({
					where: { userId },
				});

				if (!user) {
					failed.push(`${userId}: User not found`);
					continue;
				}

				// Provider admin can only update users in their own provider
				if (requestingUserType === UserType.PROVIDER_ADMIN) {
					if (user.providerId !== requestingUserProviderId) {
						failed.push(`${userId}: User not in your provider`);
						continue;
					}

					// Provider admin cannot update their own status
					if (user.userId === requestingUserId) {
						failed.push(`${userId}: Cannot update your own status`);
						continue;
					}
				}

				// Update user status
				await this.prisma.user.update({
					where: { userId },
					data: { status },
				});

				updated++;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				failed.push(`${userId}: ${errorMessage}`);
			}
		}

		return { updated, failed };
	}

	/**
	 * Search users within provider context (Provider Admin capability)
	 */
	async searchProviderUsers(
		searchTerm: string,
		requestingUserType: UserType,
		requestingUserProviderId?: string,
		limit: number = 50,
		offset: number = 0
	): Promise<User[]> {
		// Only system admin or provider admin can search users
		if (requestingUserType === UserType.TOURIST) {
			throw new Error("Insufficient permissions to search users");
		}

		let whereClause: any = {
			OR: [
				{ firstName: { contains: searchTerm, mode: "insensitive" } },
				{ lastName: { contains: searchTerm, mode: "insensitive" } },
				{ emailAddress: { contains: searchTerm, mode: "insensitive" } },
				{ phoneNumber: { contains: searchTerm } },
			],
		};

		// Provider admin can only search users in their own provider
		if (
			requestingUserType === UserType.PROVIDER_ADMIN &&
			requestingUserProviderId
		) {
			whereClause.providerId = requestingUserProviderId;
		}

		const users = await this.prisma.user.findMany({
			where: whereClause,
			take: limit,
			skip: offset,
			orderBy: { createdAt: "desc" },
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
				providerId: true,
				createdAt: true,
				updatedAt: true,
				// Exclude passwordHash for security
			},
		});

		return users.map((user) =>
			convertPrismaUserToUser({ ...user, passwordHash: "hidden" })
		);
	}

	/**
	 * Validate provider admin permissions for user operations
	 */
	private async validateProviderAdminPermissions(
		targetUserId: string,
		requestingUserId: string,
		requestingUserType: UserType,
		operation: string,
		requestingUserProviderId?: string
	): Promise<User> {
		if (requestingUserType === UserType.TOURIST) {
			throw new Error(`Insufficient permissions to ${operation}`);
		}

		const targetUser = await this.prisma.user.findUnique({
			where: { userId: targetUserId },
		});

		if (!targetUser) {
			throw new Error("Target user not found");
		}

		// System admin can perform operations on any user
		if (requestingUserType === UserType.SYSTEM_ADMIN) {
			return convertPrismaUserToUser(targetUser);
		}

		// Provider admin validations
		if (requestingUserType === UserType.PROVIDER_ADMIN) {
			// Must have provider association
			if (!requestingUserProviderId) {
				throw new Error("Provider admin must have a provider association");
			}

			// Can only operate on users in their own provider
			if (targetUser.providerId !== requestingUserProviderId) {
				throw new Error(`Cannot ${operation} users outside your provider`);
			}

			// Cannot operate on themselves for certain operations
			if (
				targetUser.userId === requestingUserId &&
				["delete", "deactivate"].includes(operation)
			) {
				throw new Error(`Cannot ${operation} yourself`);
			}

			// Cannot operate on system admin users
			if (targetUser.userType === UserType.SYSTEM_ADMIN) {
				throw new Error(`Cannot ${operation} system administrator users`);
			}
		}

		return convertPrismaUserToUser(targetUser);
	}
}
