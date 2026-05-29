import { createPortalDbAccessor } from "@repo/db/portal-db";

const portalDb = createPortalDbAccessor("portal-frontend");

export const getDbInstance = portalDb.getDbInstance;
export const getDb = portalDb.getDb;
