import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../src/types";

// Ensure we have a secure fallback secret for JWT
const getJwtSecret = (): string => {
  return process.env.JWT_SECRET || "weapply4u-secure-session-jwt-signing-fallback-key-2026";
};

export interface TokenPayload {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
}

// Extend Express Request type to include the decoded user payload
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// Generate Auth Token
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "8h" });
}

// Auth Middleware: Verifies JWT
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  let token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  // Fallback to query parameter token for redirects/popups
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: "Access denied. Auth token required." });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token expired or invalid." });
  }
}

// Role Middleware: Restricts access to ADMIN only
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Access Denied: Tier 1 Administrator privilege required." });
  }
  next();
}

// Rate Limiting utility to prevent brute force login
const loginLimiterStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimitLogin(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown-ip";
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5;      // Max 5 login tries per minute

  const limit = loginLimiterStore.get(ip);
  if (!limit) {
    loginLimiterStore.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (now > limit.resetTime) {
    // Reset window
    loginLimiterStore.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  limit.count += 1;
  if (limit.count > maxRequests) {
    return res.status(429).json({ 
      error: "Too many login attempts. Please wait 1 minute and try again to guarantee API security." 
    });
  }

  next();
}
