import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
  if (!global.prismaReadGlobal) {
    global.prismaReadGlobal = process.env.DATABASE_URL_REPLICA
      ? new PrismaClient({
          datasources: {
            db: { url: process.env.DATABASE_URL_REPLICA },
          },
        })
      : global.prismaGlobal;
  }
}

export const prisma = global.prismaGlobal ?? new PrismaClient();

export const prismaRead =
  global.prismaReadGlobal ??
  (process.env.DATABASE_URL_REPLICA
    ? new PrismaClient({
        datasources: {
          db: { url: process.env.DATABASE_URL_REPLICA },
        },
      })
    : prisma);

export default prisma;
