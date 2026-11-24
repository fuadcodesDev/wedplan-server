
import { Router } from "express";
import {
  createService,
  deleteService,
  getAdminServices,
  getMyServices,
  getServiceById,
  getServices,
  reviewService,
  updateService,
} from "../controllers/service.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Admin routes
router.get(
  "/admin/all",
  requireAuth,
  requireRole("admin"),
  getAdminServices
);

router.patch(
  "/:id/review",
  requireAuth,
  requireRole("admin"),
  reviewService
);

// Vendor routes
router.get("/vendor/mine", requireAuth, requireRole("vendor"), getMyServices);
router.post("/", requireAuth, requireRole("vendor"), createService);
router.patch("/:id", requireAuth, requireRole("vendor"), updateService);
router.delete("/:id", requireAuth, requireRole("vendor"), deleteService);

// Public routes
router.get("/", getServices);
router.get("/:id", getServiceById);

export default router;
