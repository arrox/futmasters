"""Fixtures compartidas. Redirige la DB a un tmp path por test."""
import os
import sys
import tempfile
from pathlib import Path

# Agregar backend/ al sys.path para imports tipo ``from app.*``
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest


@pytest.fixture(autouse=True)
def _tmp_db(monkeypatch, tmp_path):
    """Aísla la DB por test."""
    db_file = tmp_path / "test_fc26.db"
    monkeypatch.setenv("FC26_DB_PATH", str(db_file))
    # Re-init por las dudas si algún módulo cachea
    from app import db as db_module
    db_module.init_db()
    yield db_file
