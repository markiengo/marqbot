import pytest
from normalizer import normalize_code, normalize_input


class TestNormalizeCode:
    def test_canonical(self):
        assert normalize_code("FINA 3001") == "FINA 3001"

    def test_lowercase(self):
        assert normalize_code("fina3001") == "FINA 3001"

    def test_hyphen(self):
        assert normalize_code("FINA-3001") == "FINA 3001"

    def test_no_space(self):
        assert normalize_code("ECON1103") == "ECON 1103"

    def test_spaces_around_hyphen(self):
        assert normalize_code("FINA - 3001") == "FINA 3001"

    def test_finai(self):
        assert normalize_code("FINAI 4931") == "FINAI 4931"

    def test_aim(self):
        assert normalize_code("AIM 4400") == "AIM 4400"

    def test_invalid_no_digits(self):
        assert normalize_code("FINA") is None

    def test_invalid_garbage(self):
        assert normalize_code("asdfasdf") is None

    def test_invalid_empty(self):
        assert normalize_code("") is None

    def test_invalid_none(self):
        assert normalize_code(None) is None

    def test_mixed_case(self):
        assert normalize_code("FinA 3001") == "FINA 3001"


class TestNormalizeInput:
    CATALOG = {"FINA 3001", "ECON 1103", "ACCO 1030", "FINA 4001"}

    def test_comma_separated(self):
        result = normalize_input("FINA 3001, ECON 1103", self.CATALOG)
        assert set(result["valid"]) == {"FINA 3001", "ECON 1103"}
        assert result["invalid"] == []
        assert result["not_in_catalog"] == []

    def test_newline_separated(self):
        result = normalize_input("FINA 3001\nECON 1103", self.CATALOG)
        assert "FINA 3001" in result["valid"]

    def test_messy_codes(self):
        result = normalize_input("fina-3001, ECON1103", self.CATALOG)
        assert "FINA 3001" in result["valid"]
        assert "ECON 1103" in result["valid"]

    def test_invalid_code(self):
        result = normalize_input("asdfasdf, FINA 3001", self.CATALOG)
        assert "asdfasdf" in result["invalid"]
        assert "FINA 3001" in result["valid"]

    def test_not_in_catalog(self):
        result = normalize_input("FINA 9999", self.CATALOG)
        assert "FINA 9999" in result["not_in_catalog"]
        assert result["valid"] == []

    def test_deduplication(self):
        result = normalize_input("FINA 3001, FINA 3001, fina3001", self.CATALOG)
        assert result["valid"].count("FINA 3001") == 1

    def test_empty_input(self):
        result = normalize_input("", self.CATALOG)
        assert result == {"valid": [], "invalid": [], "not_in_catalog": []}

    def test_none_input(self):
        result = normalize_input(None, self.CATALOG)
        assert result == {"valid": [], "invalid": [], "not_in_catalog": []}
