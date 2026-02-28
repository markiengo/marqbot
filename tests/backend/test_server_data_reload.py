import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

import server


def test_reload_skips_when_mtime_unchanged(monkeypatch):
    monkeypatch.setattr(server, "_data_mtime", 100.0, raising=False)
    monkeypatch.setattr(server, "_data_file_mtime", lambda _path: 100.0)

    called = {"count": 0}

    def fake_load_data(_path):
        called["count"] += 1
        return {}

    monkeypatch.setattr(server, "load_data", fake_load_data)

    changed = server._reload_data_if_changed()
    assert changed is False
    assert called["count"] == 0


def test_reload_swaps_runtime_data_when_mtime_advances(monkeypatch):
    old_data = {"catalog_codes": ["OLD 1000"], "courses_df": "old_courses", "prereq_map": {"OLD": []}}
    new_data = {"catalog_codes": ["NEW 2000"], "courses_df": "new_courses", "prereq_map": {"NEW": []}}

    monkeypatch.setattr(server, "_data", old_data, raising=False)
    monkeypatch.setattr(server, "_reverse_map", {"old": True}, raising=False)
    monkeypatch.setattr(server, "_data_mtime", 100.0, raising=False)
    monkeypatch.setattr(server, "_data_file_mtime", lambda _path: 200.0)
    monkeypatch.setattr(server, "load_data", lambda _path: new_data)
    monkeypatch.setattr(server, "build_reverse_prereq_map", lambda _df, _map: {"new": True})
    monkeypatch.setattr(server, "compute_chain_depths", lambda _rm: {"new_chain": 1})

    changed = server._reload_data_if_changed()
    assert changed is True
    assert server._data is new_data
    assert server._reverse_map == {"new": True}
    assert server._chain_depths == {"new_chain": 1}
    assert server._data_mtime == 200.0


def test_reload_failure_keeps_previous_data(monkeypatch):
    old_data = {"catalog_codes": ["OLD 1000"], "courses_df": "old_courses", "prereq_map": {"OLD": []}}
    old_reverse_map = {"old": True}

    monkeypatch.setattr(server, "_data", old_data, raising=False)
    monkeypatch.setattr(server, "_reverse_map", old_reverse_map, raising=False)
    monkeypatch.setattr(server, "_data_mtime", 100.0, raising=False)
    monkeypatch.setattr(server, "_data_file_mtime", lambda _path: 200.0)

    def boom(_path):
        raise RuntimeError("reload failed")

    monkeypatch.setattr(server, "load_data", boom)

    changed = server._reload_data_if_changed()
    assert changed is False
    assert server._data is old_data
    assert server._reverse_map is old_reverse_map
    assert server._data_mtime == 100.0
