
import type { RequestHandler } from "express";
import { getDB } from "../config/db.js";

const transactions = () => getDB().collection("transactions");

export const getAdminTransactions: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const status =
      typeof req.query.status === "string" ? req.query.status : "all";

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const filter: Record<string, unknown> = {};

    if (status !== "all") {
      filter.status = status;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { userEmail: { $regex: escaped, $options: "i" } },
        { customerEmail: { $regex: escaped, $options: "i" } },
        { transactionId: { $regex: escaped, $options: "i" } },
        { stripeSessionId: { $regex: escaped, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      transactions()
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),

      transactions().countDocuments(filter),
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
