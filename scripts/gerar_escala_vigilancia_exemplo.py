"""
Exemplo legado — NÃO usar para gerar escala.

A RPC gerar_escala_vigilancia foi desativada (C2).
Use o app: Manutenção → Escalas → Gerar ciclo em bloco
(lib/maintenanceScaleCycle.ts → gerarCicloCompleto).
"""

from __future__ import annotations

import sys


def main() -> int:
    print(
        "Gerador SQL legado desativado.\n"
        "Use Manutenção → Escalas → Gerar ciclo em bloco no app.\n"
        "Script de migração: scripts/escalas-deprecate-legacy-generator.sql"
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
