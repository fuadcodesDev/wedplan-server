
import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const users = () => getDB().collection("user");

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET: List and search users
export const getAdminUsers: RequestHandler = async (req, res, next) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const role =
      typeof req.query.role === "string" ? req.query.role : "all";
    const status =
      typeof req.query.status === "string" ? req.query.status : "all";

    const filter: Record<string, unknown> = {};

    if (role !== "all") {
      if (!["customer", "vendor", "admin"].includes(role)) {
        res.status(400).json({ success: false, message: "Invalid role filter" });
        return;
      }
      filter.role = role;
    }

    if (status === "blocked") filter.isBlocked = true;
    else if (status === "active") {
      filter.$or = [
        { isBlocked: false },
        { isBlocked: { $exists: false } },
      ];
    } else if (status !== "all") {
      res.status(400).json({ success: false, message: "Invalid status filter" });
      return;
    }

    if (search) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: escapeRegex(search), $options: "i" } },
            { email: { $regex: escapeRegex(search), $options: "i" } },
          ],
        },
      ];
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const [data, total] = await Promise.all([
      users()
        .find(filter, {
          projection: {
            name: 1,
            email: 1,
            role: 1,
            image: 1,
            isBlocked: 1,
            createdAt: 1,
            subscriptionPlan: 1,
          },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      users().countDocuments(filter),
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH: Block or unblock a user
export const updateUserBlockStatus: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
const id = req.params.id;
const { isBlocked } = req.body;

if (typeof id !== "string") {
  res.status(400).json({
    success: false,
    message: "Invalid user ID",
  });
  return;
}

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }

    if (typeof isBlocked !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isBlocked must be true or false",
      });
      return;
    }

    const currentUser = res.locals.user;

    if (currentUser?.id === id) {
      res.status(400).json({
        success: false,
        message: "You cannot block or unblock your own account",
      });
      return;
    }

    const targetUser = await users().findOne({ _id: new ObjectId(id) });

    if (!targetUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (targetUser.role === "admin") {
      res.status(403).json({
        success: false,
        message: "Admin accounts cannot be blocked here",
      });
      return;
    }

    await users().updateOne(
      { _id: new ObjectId(id) },
      { $set: { isBlocked, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
    });
  } catch (error) {
    next(error);
  }
};
