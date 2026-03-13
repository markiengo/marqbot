"""Shared workbook I/O helpers for migration and maintenance scripts."""

from __future__ import annotations

import os
import shutil

import pandas as pd


def load_workbook_sheets(path: str) -> tuple[list[str], dict[str, pd.DataFrame]]:
    """Return sheet order and parsed sheet frames."""
    xl = pd.ExcelFile(path)
    order = list(xl.sheet_names)
    sheets = {name: xl.parse(name) for name in order}
    return order, sheets


def write_workbook(
    path: str,
    order: list[str],
    sheets: dict[str, pd.DataFrame],
) -> None:
    """Write sheets in a deterministic order to an xlsx file."""
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for sheet_name in order:
            sheets.get(sheet_name, pd.DataFrame()).to_excel(
                writer,
                sheet_name=sheet_name,
                index=False,
            )


def backup_sibling(path: str, suffix: str = ".bak") -> str:
    """Create a sibling backup file (default: `<path>.bak`)."""
    backup_path = f"{path}{suffix}"
    shutil.copy2(path, backup_path)
    return backup_path


def resolve_default_workbook(*relative_parts: str) -> str:
    """Build an absolute workbook path relative to scripts/."""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), *relative_parts))
