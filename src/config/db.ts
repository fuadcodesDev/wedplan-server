import "dotenv/config";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is missing from environment variables");
}

export const mongoClient = new MongoClient(MONGODB_URI);
export const database = mongoClient.db("wedplan");

export const connectDB = async (): Promise<void> => {
  try {
    await mongoClient.connect();
    await database.command({ ping: 1 });

    console.log("MongoDB connected successfully!");
    console.log("Database: wedplan");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};

export const getDB = () => database;