
import { Router } from "express";
import {
  getAdminUsers,
  updateUserBlockStatus,
} from "../controllers/admin-user.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getAdminUsers);
router.patch("/:id/block", updateUserBlockStatus);

export default router;
