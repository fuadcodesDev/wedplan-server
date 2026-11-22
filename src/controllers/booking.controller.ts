
import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

type AuthUser = {
  id: string;
  role: string;
};

const getUser = (res: Parameters<RequestHandler>[1]): AuthUser =>
  res.locals.user as AuthUser;

const getId = (req: Parameters<RequestHandler>[0]): string | undefined => {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
};

const validId = (id: string) => ObjectId.isValid(id);

// Customer: create a booking
export const createBooking: RequestHandler = async (req, res, next) => {
  try {
    const user = getUser(res);

    const { serviceId, eventDate, eventLocation, message } = req.body;

    if (
      typeof serviceId !== "string" ||
      !validId(serviceId) ||
      !eventDate ||
      !eventLocation?.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Service, event date, and event location are required",
      });
      return;
    }

    const parsedDate = new Date(eventDate);

    if (Number.isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid future event date",
      });
      return;
    }

    const db = getDB();

    const service = await db.collection("services").findOne({
      _id: new ObjectId(serviceId),
      status: "approved",
      isActive: { $ne: false },
    });

    if (!service) {
      res.status(404).json({
        success: false,
        message: "Approved service not found",
      });
      return;
    }

    if (String(service.vendorId) === user.id) {
      res.status(403).json({
        success: false,
        message: "You cannot book your own service",
      });
      return;
    }

    const existingBooking = await db.collection("bookings").findOne({
      serviceId: new ObjectId(serviceId),
      eventDate: parsedDate,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingBooking) {
      res.status(409).json({
        success: false,
        message: "This service already has an active booking for that date",
      });
      return;
    }

    const booking = {
      serviceId: new ObjectId(serviceId),
      vendorId: String(service.vendorId),
      customerId: user.id,
      eventDate: parsedDate,
      eventLocation: String(eventLocation).trim(),
      message: typeof message === "string" ? message.trim() : "",
      status: "pending",
      createdAt: new Date(),
    };

    const result = await db.collection("bookings").insertOne(booking);

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully",
      data: { _id: result.insertedId, ...booking },
    });
  } catch (error) {
    next(error);
  }
};

// Customer: view own bookings
export const getMyBookings: RequestHandler = async (req, res, next) => {
  try {
    const user = getUser(res);

    const bookings = await getDB()
      .collection("bookings")
      .find({ customerId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

// Vendor: view booking requests
export const getVendorBookings: RequestHandler = async (req, res, next) => {
  try {
    const user = getUser(res);

    const bookings = await getDB()
      .collection("bookings")
      .find({ vendorId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

// Vendor: accept or reject a pending booking
export const updateBookingStatus: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const user = getUser(res);
    const id = getId(req);
    const { status } = req.body;

    if (!id || !validId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
      return;
    }

    if (!["accepted", "rejected"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Status must be accepted or rejected",
      });
      return;
    }

    const result = await getDB().collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        vendorId: user.id,
        status: "pending",
      },
      {
        $set: { status, updatedAt: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Pending booking not found or not owned by you",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Customer: cancel own pending booking
export const cancelBooking: RequestHandler = async (req, res, next) => {
  try {
    const user = getUser(res);
    const id = getId(req);

    if (!id || !validId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
      return;
    }

    const result = await getDB().collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        customerId: user.id,
        status: "pending",
      },
      {
        $set: { status: "cancelled", updatedAt: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Pending booking not found or not owned by you",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};
