import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { database, mongoClient } from "./db.js";

const authSecret = process.env.BETTER_AUTH_SECRET;
const authURL = process.env.BETTER_AUTH_URL;

if (!authSecret || authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
}

if (!authURL) {
  throw new Error("BETTER_AUTH_URL is missing");
}

export const auth = betterAuth({
  database: mongodbAdapter(database, {
    client: mongoClient,
  }),

  secret: authSecret,
  baseURL: authURL,

  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3001",
  ],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  user: {
    additionalFields: {
      role: {
        type: ["customer", "vendor", "admin"],
        required: false,
        defaultValue: "customer",
        input: true,
      },
      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      subscriptionPlan: {
        type: ["free", "premium"],
        required: false,
        defaultValue: "free",
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const requestedRole = (ctx?.body as { role?: string } | undefined)?.role;

          return {
            data: {
              ...user,
              role: requestedRole === "vendor" ? "vendor" : "customer",
              isBlocked: false,
              subscriptionPlan: "free",
            },
          };
        },
      },
    },
  },
});