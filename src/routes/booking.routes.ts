
import { Router } from "express";
import {
  cancelBooking,
  createBooking,
  getMyBookings,
  getVendorBookings,
  updateBookingStatus,
} from "../controllers/booking.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Customer routes
router.post("/", requireAuth, requireRole("customer"), createBooking);
router.get("/customer/mine", requireAuth, requireRole("customer"), getMyBookings);
router.patch("/:id/cancel", requireAuth, requireRole("customer"), cancelBooking);

// Vendor routes
router.get("/vendor/requests", requireAuth, requireRole("vendor"), getVendorBookings);
router.patch("/:id/status", requireAuth, requireRole("vendor"), updateBookingStatus);

export default router;
