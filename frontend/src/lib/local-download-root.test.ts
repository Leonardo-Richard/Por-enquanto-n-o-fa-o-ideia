import { describe, expect, it } from "vitest";
import { auditSuffixPreview, validateLocalDownloadRoot } from "./local-download-root";

describe("validateLocalDownloadRoot", () => {
  it("aceita null e string vazia normalizada", () => {
    expect(validateLocalDownloadRoot(null)).toEqual({ ok: true, value: null });
    expect(validateLocalDownloadRoot("  \t ")).toEqual({ ok: true, value: null });
  });

  it("aceita caminho Windows simples", () => {
    expect(validateLocalDownloadRoot("C:\\NFs")).toEqual({ ok: true, value: "C:\\NFs" });
  });

  it("rejeia comprimento excessivo", () => {
    const long = "C:\\" + "x".repeat(520);
    const r = validateLocalDownloadRoot(long);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("LOCAL_PATH_TOO_LONG");
    }
  });

  it("rejeia caracteres de controlo", () => {
    const r = validateLocalDownloadRoot("C:\\NF\x01s");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("LOCAL_PATH_INVALID_CHARS");
    }
  });

  it("rejeia segmento ..", () => {
    const r = validateLocalDownloadRoot("C:\\NFs\\..\\Windows");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("LOCAL_PATH_TRAVERSAL");
    }
  });

  it("rejeia UNC", () => {
    const r = validateLocalDownloadRoot("\\\\server\\share\\nfs");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("LOCAL_PATH_TRAVERSAL");
    }
  });

  it("rejeia extended path antes de mensagem UNC genérica", () => {
    const r = validateLocalDownloadRoot("\\\\?\\C:\\NFs");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("LOCAL_PATH_TRAVERSAL");
      expect(r.message).toMatch(/extended path|\\\\\?\\/i);
    }
  });

  it("rejeia wildcards / símbolos Windows com LOCAL_PATH_INVALID", () => {
    const r = validateLocalDownloadRoot("C:\\NFs\\*");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("LOCAL_PATH_INVALID");
    }
  });
});

describe("auditSuffixPreview", () => {
  it("trunca com prefixo …", () => {
    const s = "C:\\Very\\Long\\Path\\To\\Folder";
    expect(auditSuffixPreview(s, 8)).toMatch(/^…/);
  });
});
