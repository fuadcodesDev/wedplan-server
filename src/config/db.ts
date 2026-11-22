
import { MongoClient, Db } from "mongodb";

let database: Db;

export const connectDB = async (): Promise<void> => {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment variables");
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();

    database = client.db("wedplan");

    await database.command({ ping: 1 });

    console.log("MongoDB connected successfully!");
    console.log("Database: wedplan");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

export const getDB = (): Db => {
  if (!database) {
    throw new Error("Database is not connected yet");
  }

  return database;
};
