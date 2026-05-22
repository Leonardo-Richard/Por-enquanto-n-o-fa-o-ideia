import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleGetAdnArtifactsPdfsZip } from "./adn-artifacts-pdfs-zip";
import { resolveAdnPublicAccess } from "./adn-public-access";
import { downloadAdnObjectBytes, adnPdfsZipMaxCount, adnPdfsZipMaxTotalBytes } from "@/lib/adn-storage";
import { insertAuditEvent } from "@/lib/audit";

vi.mock("./adn-public-access");
vi.mock("@/lib/adn-storage", () => ({
  downloadAdnObjectBytes: vi.fn(),
  adnPdfsZipMaxCount: () => 200,
  adnPdfsZipMaxTotalBytes: () => 150 * 1024 * 1024,
}));
vi.mock("@/lib/audit", () => ({
  insertAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

type PdfRow = {
  id: string;
  accessKey: string;
  storageObjectKey: string;
  byteSize: number | null;
};

function mockDb(opts: {
  cnpjDigits?: string;
  pdfs?: PdfRow[];
}) {
  const companyChain = {
    limit: vi.fn().mockResolvedValue(
      opts.cnpjDigits === undefined ? [] : [{ cnpjDigits: opts.cnpjDigits }],
    ),
  };
  const artifactsChain = {
    orderBy: vi.fn().mockResolvedValue(opts.pdfs ?? []),
  };
  return {
    select: vi.fn((fields: unknown) => {
      const isCompany =
        fields &&
        typeof fields === "object" &&
        "cnpjDigits" in (fields as Record<string, unknown>);
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => (isCompany ? companyChain : artifactsChain)),
        })),
      };
    }),
  };
}

const orgId = "00000000-0000-4000-8000-000000000001";
const companyId = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveAdnPublicAccess).mockResolvedValue({
    ok: true,
    ctx: {
      db: mockDb({ cnpjDigits: "12345678000199", pdfs: [] }) as never,
      session: { user: { id: "user-1" } } as never,
      organizationId: orgId,
      companyId,
      superadmin: false,
      orgRole: "admin",
    },
  });
});

describe("handleGetAdnArtifactsPdfsZip", () => {
  it("propaga gate 403", async () => {
    vi.mocked(resolveAdnPublicAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ message: "negado" }, { status: 403 }),
    });
    const res = await handleGetAdnArtifactsPdfsZip(new Request("http://t"), orgId, companyId);
    expect(res.status).toBe(403);
  });

  it("404 quando não há PDFs", async () => {
    const res = await handleGetAdnArtifactsPdfsZip(new Request("http://t"), orgId, companyId);
    expect(res.status).toBe(404);
    const j = (await res.json()) as { message?: string };
    expect(j.message).toMatch(/Sem PDFs/i);
  });

  it("413 quando excede contagem máxima", async () => {
    const max = adnPdfsZipMaxCount();
    const pdfs: PdfRow[] = Array.from({ length: max + 1 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      accessKey: `key${i}`.padEnd(44, "0"),
      storageObjectKey: `org/x/${i}.pdf`,
      byteSize: 100,
    }));
    vi.mocked(resolveAdnPublicAccess).mockResolvedValue({
      ok: true,
      ctx: {
        db: mockDb({ cnpjDigits: "12345678000199", pdfs }) as never,
        session: { user: { id: "user-1" } } as never,
        organizationId: orgId,
        companyId,
        superadmin: false,
        orgRole: "admin",
      },
    });
    const res = await handleGetAdnArtifactsPdfsZip(new Request("http://t"), orgId, companyId);
    expect(res.status).toBe(413);
  });

  it("413 quando excede bytes totais", async () => {
    const maxBytes = adnPdfsZipMaxTotalBytes();
    vi.mocked(resolveAdnPublicAccess).mockResolvedValue({
      ok: true,
      ctx: {
        db: mockDb({
          cnpjDigits: "12345678000199",
          pdfs: [
            {
              id: "00000000-0000-4000-8000-000000000099",
              accessKey: "k".repeat(44),
              storageObjectKey: "org/x/a.pdf",
              byteSize: maxBytes + 1,
            },
          ],
        }) as never,
        session: { user: { id: "user-1" } } as never,
        organizationId: orgId,
        companyId,
        superadmin: false,
        orgRole: "admin",
      },
    });
    const res = await handleGetAdnArtifactsPdfsZip(new Request("http://t"), orgId, companyId);
    expect(res.status).toBe(413);
  });

  it("200 ZIP com um PDF e regista auditoria", async () => {
    const pdf: PdfRow = {
      id: "00000000-0000-4000-8000-000000000010",
      accessKey: "a".repeat(44),
      storageObjectKey: "org/x/doc.pdf",
      byteSize: 50,
    };
    vi.mocked(resolveAdnPublicAccess).mockResolvedValue({
      ok: true,
      ctx: {
        db: mockDb({ cnpjDigits: "12345678000199", pdfs: [pdf] }) as never,
        session: { user: { id: "user-1" } } as never,
        organizationId: orgId,
        companyId,
        superadmin: false,
        orgRole: "admin",
      },
    });
    vi.mocked(downloadAdnObjectBytes).mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

    const res = await handleGetAdnArtifactsPdfsZip(new Request("http://t"), orgId, companyId);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toMatch(/pdfs-12345678000199-/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(22);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    expect(insertAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "adn_artifacts_bulk_downloaded",
        metadata: { count: 1, totalBytes: 50 },
      }),
    );
  });

  it("503 quando falha download do storage", async () => {
    vi.mocked(resolveAdnPublicAccess).mockResolvedValue({
      ok: true,
      ctx: {
        db: mockDb({
          cnpjDigits: "12345678000199",
          pdfs: [
            {
              id: "00000000-0000-4000-8000-000000000011",
              accessKey: "b".repeat(44),
              storageObjectKey: "org/x/missing.pdf",
              byteSize: 10,
            },
          ],
        }) as never,
        session: { user: { id: "user-1" } } as never,
        organizationId: orgId,
        companyId,
        superadmin: false,
        orgRole: "admin",
      },
    });
    vi.mocked(downloadAdnObjectBytes).mockRejectedValue(new Error("not found"));

    const res = await handleGetAdnArtifactsPdfsZip(new Request("http://t"), orgId, companyId);
    expect(res.status).toBe(503);
  });
});
