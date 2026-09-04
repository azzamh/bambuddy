"""Tests for the printer power estimates behind the 'estimated' energy mode."""

import pytest

from backend.app.utils.printer_power import (
    DEFAULT_MODEL_POWER_WATTS,
    FALLBACK_POWER_WATTS,
    estimate_kwh,
    resolve_power_watts,
)


class TestResolvePowerWatts:
    def test_known_model_uses_the_builtin_table(self):
        assert resolve_power_watts("A1 Mini") == DEFAULT_MODEL_POWER_WATTS["A1 Mini"]

    @pytest.mark.parametrize("name", ["a1 mini", "A1Mini", "A1-MINI", "a1mini"])
    def test_model_matching_ignores_case_spaces_and_dashes(self, name):
        assert resolve_power_watts(name) == DEFAULT_MODEL_POWER_WATTS["A1 Mini"]

    def test_override_wins_over_the_builtin_table(self):
        assert resolve_power_watts("A1 Mini", {"A1 Mini": 72.5}) == 72.5

    def test_override_matching_is_also_normalized(self):
        assert resolve_power_watts("A1 Mini", {"a1mini": 80}) == 80

    def test_unknown_model_falls_back(self):
        assert resolve_power_watts("Some Other Printer") == FALLBACK_POWER_WATTS

    def test_missing_model_falls_back(self):
        assert resolve_power_watts(None) == FALLBACK_POWER_WATTS
        assert resolve_power_watts("") == FALLBACK_POWER_WATTS

    @pytest.mark.parametrize("bad", [0, -50, "abc", None])
    def test_unusable_override_falls_through_to_the_default(self, bad):
        # A blank or nonsense override must not zero out the estimate
        assert resolve_power_watts("A1", {"A1": bad}) == DEFAULT_MODEL_POWER_WATTS["A1"]


class TestEstimateKwh:
    def test_uses_watts_times_hours(self):
        # 100 W for 10 h = 1 kWh
        assert estimate_kwh("A1", 36000) == pytest.approx(1.0)

    def test_respects_overrides(self):
        assert estimate_kwh("A1", 36000, {"A1": 200}) == pytest.approx(2.0)

    @pytest.mark.parametrize("seconds", [None, 0, -5])
    def test_no_duration_means_no_energy(self, seconds):
        assert estimate_kwh("A1", seconds) == 0.0

    def test_unknown_model_still_produces_an_estimate(self):
        # The point of the mode is never reporting a flat zero
        assert estimate_kwh("Mystery", 3600) == pytest.approx(FALLBACK_POWER_WATTS / 1000)
