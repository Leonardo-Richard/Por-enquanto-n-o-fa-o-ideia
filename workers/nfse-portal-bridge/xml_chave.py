"""Extracção da chave de acesso (44 caracteres) a partir de XML NFS-e — espelho simplificado de NFSE_dist/processor.py."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET


def extract_access_key_from_xml(xml_text: str) -> str | None:
    try:
        root = ET.fromstring(xml_text)
        found = root.find(".//{*}infNFSe")
        if found is not None:
            raw_id = found.attrib.get("Id") or found.attrib.get("id")
            if raw_id:
                return raw_id.replace("NFS", "").strip()
        for path in (".//{*}chNFSe", ".//{*}chaveAcesso", ".//{*}ChaveNFSe", ".//{*}chaveNFSe"):
            node = root.find(path)
            if node is not None and node.text:
                t = node.text.strip()
                if len(t) == 44 and t.isdigit():
                    return t
    except ET.ParseError:
        pass
    m = re.search(r"\b(\d{44})\b", xml_text)
    if m:
        return m.group(1)
    return None
