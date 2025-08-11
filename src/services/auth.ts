import jwt from "jsonwebtoken";
import { PrismaClient } from "../generated/prisma";
import { User, UserType } from "../types/user";
import { UserService } from "./user";
import { config } from "../config";

export interface JWTPayload {
	sub: string; // user ID
	email: string;
	role: UserType;
	providerId?: string;
	iat?: number;
	exp?: number;
}

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
	expiresIn: string;
}

export interface RefreshTokenData {
	userId: string;
	tokenId: string;
	expiresAt: Date;
}

export class AuthService {
	private userService: UserService;

	constructor(private prisma: PrismaClient) {
		this.userService = new UserService(prisma);
	}

	/**
	 * Generate JWT access token
	 */
	generateAccessToken(user: User): string {
		const payload: JWTPayload = {
			sub: user.userId,
			email: user.emailAddress,
			role: user.userType,
			providerId: user.providerId || undefined,
		};

		return jwt.sign(
			payload,
			config.jwt.secret as string,
			{
				expiresIn: config.jwt.expiresIn,
			} as jwt.SignOptions
		);
	}

	/**
	 * Generate JWT refresh token with rotation
	 */
	async generateRefreshToken(userId: string): Promise<string> {
		// Generate unique token ID for tracking
		const tokenId = this.generateTokenId();
		const expiresAt = new Date();
		expiresAt.setTime(
			expiresAt.getTime() + this.parseTimeToMs(config.jwt.refreshExpiresIn)
		);

		// Store refresh token data in database
		await this.prisma.refreshToken.create({
			data: {
				tokenId,
				userId,
				expiresAt,
				isRevoked: false,
			},
		});

		const payload = {
			sub: userId,
			tokenId,
			type: "refresh",
		};

		return jwt.sign(
			payload,
			config.jwt.refreshSecret as string,
			{
				expiresIn: config.jwt.refreshExpiresIn,
			} as jwt.SignOptions
		);
	}

	/**
	 * Validate JWT access token
	 */
	validateAccessToken(token: string): JWTPayload {
		try {
			const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

			return decoded;
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				throw new Error("Access token has expired");
			} else if (error instanceof jwt.JsonWebTokenError) {
				throw new Error("Invalid access token");
			} else {
				throw new Error("Token validation failed");
			}
		}
	}

	/**
	 * Validate JWT refresh token
	 */
	async validateRefreshToken(token: string): Promise<RefreshTokenData> {
		try {
			const decoded = jwt.verify(token, config.jwt.refreshSecret) as any;

			if (decoded.type !== "refresh") {
				throw new Error("Invalid token type");
			}

			// Check if refresh token exists and is not revoked
			const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
				where: { tokenId: decoded.tokenId },
			});

			if (!refreshTokenRecord || refreshTokenRecord.isRevoked) {
				throw new Error("Refresh token has been revoked");
			}

			if (refreshTokenRecord.expiresAt < new Date()) {
				throw new Error("Refresh token has expired");
			}

			return {
				userId: decoded.sub,
				tokenId: decoded.tokenId,
				expiresAt: refreshTokenRecord.expiresAt,
			};
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				throw new Error("Refresh token has expired");
			} else if (error instanceof jwt.JsonWebTokenError) {
				throw new Error("Invalid refresh token");
			} else {
				throw error;
			}
		}
	}

	/**
	 * Authenticate user with email and password
	 */
	async authenticateUser(
		email: string,
		password: string
	): Promise<{ user: User; tokens: AuthTokens }> {
		// Verify credentials using UserService
		const user = await this.userService.verifyCredentials(email, password);

		if (!user) {
			throw new Error("Invalid credentials");
		}

		if (user.status !== "ACTIVE") {
			throw new Error("User account is inactive");
		}

		// Generate tokens
		const userForToken: User = {
			...user,
			middleName: user.middleName || undefined,
			userType: user.userType as any,
			status: user.status as any,
		};
		const accessToken = this.generateAccessToken(userForToken);
		const refreshToken = await this.generateRefreshToken(user.userId);

		return {
			user,
			tokens: {
				accessToken,
				refreshToken,
				expiresIn: config.jwt.expiresIn,
			},
		};
	}

	/**
	 * Refresh access token using refresh token
	 */
	async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
		// Validate refresh token
		const refreshData = await this.validateRefreshToken(refreshToken);

		// Get user data
		const user = await this.prisma.user.findUnique({
			where: { userId: refreshData.userId },
		});

		if (!user || user.status !== "ACTIVE") {
			throw new Error("User not found or inactive");
		}

		// Revoke old refresh token
		await this.revokeRefreshToken(refreshData.tokenId);

		// Generate new tokens
		const userForToken: User = {
			...user,
			middleName: user.middleName || undefined,
			userType: user.userType as any,
			status: user.status as any,
		};
		const newAccessToken = this.generateAccessToken(userForToken);
		const newRefreshToken = await this.generateRefreshToken(user.userId);

		return {
			accessToken: newAccessToken,
			refreshToken: newRefreshToken,
			expiresIn: config.jwt.expiresIn,
		};
	}

	/**
	 * Revoke refresh token
	 */
	async revokeRefreshToken(tokenId: string): Promise<void> {
		await this.prisma.refreshToken.update({
			where: { tokenId },
			data: { isRevoked: true },
		});
	}

	/**
	 * Revoke all refresh tokens for a user (logout from all devices)
	 */
	async revokeAllUserTokens(userId: string): Promise<void> {
		await this.prisma.refreshToken.updateMany({
			where: {
				userId,
				isRevoked: false,
			},
			data: { isRevoked: true },
		});
	}

	/**
	 * Logout user by revoking refresh token
	 */
	async logoutUser(refreshToken: string): Promise<void> {
		try {
			const refreshData = await this.validateRefreshToken(refreshToken);
			await this.revokeRefreshToken(refreshData.tokenId);
		} catch (error) {
			// Token might already be invalid/revoked, which is fine for logout
			console.warn("Logout attempted with invalid refresh token:", error);
		}
	}

	/**
	 * Clean up expired refresh tokens
	 */
	async cleanupExpiredTokens(): Promise<void> {
		await this.prisma.refreshToken.deleteMany({
			where: {
				OR: [{ expiresAt: { lt: new Date() } }, { isRevoked: true }],
			},
		});
	}

	/**
	 * Generate unique token ID
	 */
	private generateTokenId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Parse time string to milliseconds
	 */
	private parseTimeToMs(timeStr: string): number {
		const unit = timeStr.slice(-1);
		const value = parseInt(timeStr.slice(0, -1));

		switch (unit) {
			case "s":
				return value * 1000;
			case "m":
				return value * 60 * 1000;
			case "h":
				return value * 60 * 60 * 1000;
			case "d":
				return value * 24 * 60 * 60 * 1000;
			default:
				return value;
		}
	}
}
