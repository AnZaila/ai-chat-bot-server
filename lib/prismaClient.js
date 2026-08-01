const { PrismaClient } = require("@prisma/client");

const isProduction = process.env.NODE_ENV === "production";

const prismaClient = new PrismaClient({
  log: isProduction
    ? ["error", "warn"]
    : ["error", "warn", "query"],
  errorFormat: isProduction ? "minimal" : "colorless",
});

module.exports = prismaClient;
