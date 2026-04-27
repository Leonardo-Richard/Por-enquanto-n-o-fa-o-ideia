import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const companyRoleEnum = pgEnum("company_role", ["user", "admin"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  isSuperadmin: boolean("isSuperadmin").notNull().default(false),
});

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tradeName: text("trade_name"),
    taxIdDigits: char("tax_id_digits", { length: 14 }),
    active: boolean("active").notNull().default(true),
    adnSyncEnabled: boolean("adn_sync_enabled").notNull().default(false),
    /** Caminho absoluto na VM do worker (ex.: C:\\NFs). Espelho: {root}/{CNPJ}/{system_code}/{chave}.xml|.pdf */
    localDownloadRoot: text("local_download_root"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("organizations_tax_id_digits_unique_partial")
      .on(t.taxIdDigits)
      .where(sql`${t.taxIdDigits} IS NOT NULL`),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    cnpjDigits: varchar("cnpj_digits", { length: 14 }).notNull(),
    tradeName: text("trade_name").notNull(),
    systemCode: text("system_code").notNull(),
    monthlyRunDay: smallint("monthly_run_day").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    accountId: text("account_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("companies_org_cnpj_system_unique").on(t.organizationId, t.cnpjDigits, t.systemCode),
  ],
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  activeCompanyId: uuid("activeCompanyId").references(() => companies.id, {
    onDelete: "set null",
  }),
  activeOrganizationId: uuid("activeOrganizationId").references(() => organizations.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orgRole: companyRoleEnum("org_role").notNull(),
    jobTitle: text("job_title"),
    department: text("department"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("organization_memberships_user_org_unique").on(t.userId, t.organizationId)],
);

export const companyMemberships = pgTable(
  "company_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyRole: companyRoleEnum("company_role").notNull(),
    jobTitle: text("job_title"),
    department: text("department"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("company_memberships_user_company_unique").on(t.userId, t.companyId)],
);

export const adnSyncJobs = pgTable("adn_sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  trigger: text("trigger").notNull().default("manual"),
  requestedByUserId: text("requested_by_user_id").references(() => user.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key"),
  idempotencyBodyFingerprint: char("idempotency_body_fingerprint", { length: 64 }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  summaryJson: jsonb("summary_json").$type<Record<string, unknown> | null>(),
  workerCorrelationId: text("worker_correlation_id"),
  http429Count: integer("http_429_count").notNull().default(0),
  http503Count: integer("http_503_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adnArtifactDrafts = pgTable("adn_artifact_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  accessKey: char("access_key", { length: 44 }).notNull(),
  kind: text("kind").notNull(),
  contentSha256: char("content_sha256", { length: 64 }).notNull(),
  storageBucket: text("storage_bucket").notNull(),
  storageObjectKey: text("storage_object_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const adnArtifacts = pgTable(
  "adn_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    adnSyncJobId: uuid("adn_sync_job_id").references(() => adnSyncJobs.id, { onDelete: "set null" }),
    accessKey: char("access_key", { length: 44 }).notNull(),
    accessKeyPrefix: text("access_key_prefix"),
    accessKeySuffix: text("access_key_suffix"),
    kind: text("kind").notNull(),
    contentSha256: char("content_sha256", { length: 64 }).notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storageObjectKey: text("storage_object_key").notNull(),
    contentType: text("content_type"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("adn_artifacts_company_access_kind").on(t.companyId, t.accessKey, t.kind)],
);

export const adnIngestionFailures = pgTable("adn_ingestion_failures", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  adnSyncJobId: uuid("adn_sync_job_id").references(() => adnSyncJobs.id, { onDelete: "set null" }),
  accessKey: char("access_key", { length: 44 }),
  kind: text("kind"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  errorCode: text("error_code").notNull(),
  errorDetail: text("error_detail"),
  canRetry: boolean("can_retry").notNull().default(true),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const companyCertificates = pgTable(
  "company_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    notAfter: date("not_after"),
    vaultRef: text("vault_ref").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("company_certificates_company_unique").on(t.companyId)],
);

export const companyCertificateAudits = pgTable("company_certificate_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  outcome: text("outcome").notNull(),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(companyMemberships),
  organizationMemberships: many(organizationMemberships),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  companies: many(companies),
  memberships: many(organizationMemberships),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  memberships: many(companyMemberships),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
  activeCompany: one(companies, {
    fields: [session.activeCompanyId],
    references: [companies.id],
  }),
  activeOrganization: one(organizations, {
    fields: [session.activeOrganizationId],
    references: [organizations.id],
  }),
}));

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id],
  }),
  user: one(user, {
    fields: [organizationMemberships.userId],
    references: [user.id],
  }),
}));

export const companyMembershipsRelations = relations(companyMemberships, ({ one }) => ({
  company: one(companies, {
    fields: [companyMemberships.companyId],
    references: [companies.id],
  }),
  user: one(user, {
    fields: [companyMemberships.userId],
    references: [user.id],
  }),
}));
