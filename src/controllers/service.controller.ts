
import { RequestHandler } from "express";
import { ObjectId, type Sort } from "mongodb";
import { getDB } from "../config/db.js";

const services = () => getDB().collection("services");

const validId = (id: string) => ObjectId.isValid(id);

const getRouteId = (req: Parameters<RequestHandler>[0]): string | undefined => {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// PUBLIC: Browse approved and active services
export const getServices: RequestHandler = async (req, res, next) => {
  try {
    const {
      search,
      category,
      location,
      sort,
      page = "1",
      limit = "12",
    } = req.query;

    const filter: Record<string, unknown> = {
      status: "approved",
      isActive: true,
    };

    if (typeof search === "string" && search.trim()) {
      filter.serviceName = {
        $regex: escapeRegex(search.trim()),
        $options: "i",
      };
    }

    if (typeof category === "string" && category.trim()) {
      filter.category = category.trim();
    }

    if (typeof location === "string" && location.trim()) {
      filter.location = {
        $regex: escapeRegex(location.trim()),
        $options: "i",
      };
    }

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 12));

    const sortOption: Sort =
      sort === "price-asc"
        ? { price: 1 }
        : sort === "price-desc"
          ? { price: -1 }
          : { createdAt: -1 };

    const [data, total] = await Promise.all([
      services()
        .find(filter)
        .sort(sortOption)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .toArray(),

      services().countDocuments(filter),
    ]);

    res.json({
      success: true,
      message: "Services retrieved successfully",
      data,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUBLIC: Get one approved service
export const getServiceById: RequestHandler = async (req, res, next) => {
  try {
    const id = getRouteId(req);

    if (typeof id !== "string" || !validId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
      return;
    }

    const service = await services().findOne({
      _id: new ObjectId(id),
      status: "approved",
      isActive: true,
    });

    if (!service) {
      res.status(404).json({
        success: false,
        message: "Service not found",
      });
      return;
    }

    res.json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

// VENDOR: Create a service
export const createService: RequestHandler = async (req, res, next) => {
  try {
    const user = res.locals.user;

    const {
      serviceName,
      category,
      description,
      price,
      location,
      images,
    } = req.body;

    if (
      typeof serviceName !== "string" ||
      !serviceName.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0 ||
      typeof location !== "string" ||
      !location.trim() ||
      !Array.isArray(images) ||
      images.length === 0 ||
      !images.every(
        (image: unknown) =>
          typeof image === "string" && image.trim().length > 0
      )
    ) {
      res.status(400).json({
        success: false,
        message:
          "Please provide valid service details and at least one image URL",
      });
      return;
    }

    const activeCount = await services().countDocuments({
      vendorId: user.id,
      isActive: true,
    });

    if (user.subscriptionPlan !== "premium" && activeCount >= 3) {
      res.status(403).json({
        success: false,
        message: "Free plan allows a maximum of 3 active services",
      });
      return;
    }

    const newService = {
      vendorId: user.id,
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      price: Number(price),
      location: location.trim(),
      images: images.map((image: string) => image.trim()),
      status: "pending",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await services().insertOne(newService);

    res.status(201).json({
      success: true,
      message: "Service submitted for admin approval",
      data: {
        ...newService,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// VENDOR: Update own service; edited services require approval again
export const updateService: RequestHandler = async (req, res, next) => {
  try {
    const user = res.locals.user;
    const id = getRouteId(req);

    if (typeof id !== "string" || !validId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
      return;
    }

    const allowedFields = [
      "serviceName",
      "category",
      "description",
      "price",
      "location",
      "images",
      "isActive",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: "No valid fields provided",
      });
      return;
    }

    for (const field of ["serviceName", "category", "description", "location"]) {
      if (
        updates[field] !== undefined &&
        (typeof updates[field] !== "string" ||
          !(updates[field] as string).trim())
      ) {
        res.status(400).json({
          success: false,
          message: `Invalid ${field}`,
        });
        return;
      }

      if (typeof updates[field] === "string") {
        updates[field] = (updates[field] as string).trim();
      }
    }

    if (
      updates.price !== undefined &&
      (!Number.isFinite(Number(updates.price)) || Number(updates.price) <= 0)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid service price",
      });
      return;
    }

    if (updates.price !== undefined) {
      updates.price = Number(updates.price);
    }

    if (
      updates.images !== undefined &&
      (!Array.isArray(updates.images) ||
        updates.images.length === 0 ||
        !updates.images.every(
          (image: unknown) =>
            typeof image === "string" && image.trim().length > 0
        ))
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide valid image URLs",
      });
      return;
    }

    if (Array.isArray(updates.images)) {
      updates.images = updates.images.map((image: string) => image.trim());
    }

    if (
      updates.isActive !== undefined &&
      typeof updates.isActive !== "boolean"
    ) {
      res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
      return;
    }

    if (updates.isActive === true && user.subscriptionPlan !== "premium") {
      const activeCount = await services().countDocuments({
        vendorId: user.id,
        isActive: true,
        _id: { $ne: new ObjectId(id) },
      });

      if (activeCount >= 3) {
        res.status(403).json({
          success: false,
          message: "Free plan allows a maximum of 3 active services",
        });
        return;
      }
    }

    updates.status = "pending";
    updates.updatedAt = new Date();

    const result = await services().updateOne(
      {
        _id: new ObjectId(id),
        vendorId: user.id,
      },
      {
        $set: updates,
      }
    );

    if (!result.matchedCount) {
      res.status(404).json({
        success: false,
        message: "Service not found or you do not own it",
      });
      return;
    }

    res.json({
      success: true,
      message: "Service updated and submitted for approval",
    });
  } catch (error) {
    next(error);
  }
};

// VENDOR: Delete own service
export const deleteService: RequestHandler = async (req, res, next) => {
  try {
    const user = res.locals.user;
    const id = getRouteId(req);

    if (typeof id !== "string" || !validId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
      return;
    }

    const result = await services().deleteOne({
      _id: new ObjectId(id),
      vendorId: user.id,
    });

    if (!result.deletedCount) {
      res.status(404).json({
        success: false,
        message: "Service not found or you do not own it",
      });
      return;
    }

    res.json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Approve or reject a service
export const reviewService: RequestHandler = async (req, res, next) => {
  try {
    const id = getRouteId(req);
    const { status } = req.body;

    if (typeof id !== "string" || !validId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
      return;
    }

    if (status !== "approved" && status !== "rejected") {
      res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
      return;
    }

    const result = await services().updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    if (!result.matchedCount) {
      res.status(404).json({
        success: false,
        message: "Service not found",
      });
      return;
    }

    res.json({
      success: true,
      message: `Service ${status} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// VENDOR: List own services
export const getMyServices: RequestHandler = async (_req, res, next) => {
  try {
    const user = res.locals.user;

    const data = await services()
      .find({ vendorId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
