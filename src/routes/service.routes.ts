import { Router } from "express";
import {
  createService,
  deleteService,
  getMyServices,
  getServiceById,
  getServices,
  reviewService,
  updateService,
} from "../controllers/service.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.get("/", getServices);
router.get("/:id", getServiceById);

// Vendor routes
router.get("/vendor/mine", requireAuth, requireRole("vendor"), getMyServices);
router.post("/", requireAuth, requireRole("vendor"), createService);
router.patch("/:id", requireAuth, requireRole("vendor"), updateService);
router.delete("/:id", requireAuth, requireRole("vendor"), deleteService);

// Admin route
router.patch(
  "/:id/review",
  requireAuth,
  requireRole("admin"),
  reviewService
);

export default router;