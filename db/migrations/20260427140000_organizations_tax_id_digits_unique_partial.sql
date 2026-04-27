-- SORG-02: unicidade parcial de CNPJ na organização (FR44)
CREATE UNIQUE INDEX IF NOT EXISTS organizations_tax_id_digits_unique_partial
  ON organizations (tax_id_digits)
  WHERE tax_id_digits IS NOT NULL;
