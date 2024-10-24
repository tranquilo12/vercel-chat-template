import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  path: ".env.development.local",
});

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./lib/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
