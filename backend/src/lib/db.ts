import { createPortalDbAccessor } from "@repo/db/portal-db";

const portalDb = createPortalDbAccessor("portal-backend");

export const getDbInstance = portalDb.getDbInstance;
export const getDb = portalDb.getDb;
