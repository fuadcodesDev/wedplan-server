
import { Router } from "express";
import { getAdminTransactions } from "../controllers/admin-transaction.controller.js";
import {
  requireAuth,
  requireRole,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getAdminTransactions);

export default router;
