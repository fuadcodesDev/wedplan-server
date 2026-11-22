import { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({
        success: false,
        message: "Please sign in to continue",
      });
      return;
    }

    if (session.user.isBlocked) {
      res.status(403).json({
        success: false,
        message: "Your account has been blocked",
      });
      return;
    }

    res.locals.user = session.user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: string[]): RequestHandler => {
  return (_req, res, next) => {
    const user = res.locals.user;

    if (!user || !roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
      return;
    }

    next();
  };
};