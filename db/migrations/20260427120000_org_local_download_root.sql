-- LM-01A / FR58: pasta raiz na VM do worker para espelho XML/PDF em disco.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS local_download_root TEXT NULL;

COMMENT ON COLUMN organizations.local_download_root IS
  'Caminho absoluto na máquina do worker; árvore {root}/{cnpj_digits}/{system_code}/{chave}.xml|.pdf';
