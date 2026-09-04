"""Integration tests for the 'estimated' energy tracking mode.

The mode exists for fleets without smart plugs on every printer: measured
readings are used where a plug recorded one, and everything else is estimated
from the printer's model and how long the print ran.
"""

import json

import pytest
from httpx import AsyncClient

from backend.app.api.routes.settings import set_setting
from backend.app.utils.printer_power import DEFAULT_MODEL_POWER_WATTS, FALLBACK_POWER_WATTS


async def _use_estimated_mode(db_session, overrides: dict | None = None):
    await set_setting(db_session, "energy_tracking_mode", "estimated")
    await set_setting(db_session, "energy_cost_per_kwh", "0.20")
    if overrides is not None:
        await set_setting(db_session, "printer_power_watts", json.dumps(overrides))
    await db_session.commit()


class TestEstimatedEnergyMode:
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_estimates_from_model_and_duration(
        self, async_client: AsyncClient, archive_factory, printer_factory, db_session
    ):
        printer = await printer_factory(model="A1 Mini")
        # Two hours on a 65 W A1 mini = 0.13 kWh
        await archive_factory(printer.id, print_time_seconds=7200)
        await _use_estimated_mode(db_session)

        response = await async_client.get("/api/v1/archives/stats")
        assert response.status_code == 200
        data = response.json()

        expected_kwh = DEFAULT_MODEL_POWER_WATTS["A1 Mini"] * 2 / 1000
        assert data["total_energy_kwh"] == pytest.approx(expected_kwh, abs=0.001)
        assert data["total_energy_cost"] == pytest.approx(expected_kwh * 0.20, abs=0.001)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_measured_energy_wins_over_the_estimate(
        self, async_client: AsyncClient, archive_factory, printer_factory, db_session
    ):
        printer = await printer_factory(model="A1 Mini")
        # A plug measured this one, so the estimate must not be used for it
        await archive_factory(printer.id, print_time_seconds=7200, energy_kwh=0.5, energy_cost=0.11)
        await _use_estimated_mode(db_session)

        data = (await async_client.get("/api/v1/archives/stats")).json()

        assert data["total_energy_kwh"] == pytest.approx(0.5, abs=0.001)
        # The stored cost is kept — it was priced at the tariff in force then
        assert data["total_energy_cost"] == pytest.approx(0.11, abs=0.001)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_mixes_measured_and_estimated_prints(
        self, async_client: AsyncClient, archive_factory, printer_factory, db_session
    ):
        printer = await printer_factory(model="A1 Mini")
        await archive_factory(printer.id, print_time_seconds=7200, energy_kwh=0.5, energy_cost=0.11)
        await archive_factory(printer.id, print_time_seconds=7200)
        await _use_estimated_mode(db_session)

        data = (await async_client.get("/api/v1/archives/stats")).json()

        estimated = DEFAULT_MODEL_POWER_WATTS["A1 Mini"] * 2 / 1000
        assert data["total_energy_kwh"] == pytest.approx(0.5 + estimated, abs=0.001)
        assert data["total_energy_cost"] == pytest.approx(0.11 + estimated * 0.20, abs=0.001)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_settings_override_replaces_the_builtin_wattage(
        self, async_client: AsyncClient, archive_factory, printer_factory, db_session
    ):
        printer = await printer_factory(model="A1 Mini")
        await archive_factory(printer.id, print_time_seconds=3600)
        await _use_estimated_mode(db_session, overrides={"A1 Mini": 200})

        data = (await async_client.get("/api/v1/archives/stats")).json()

        assert data["total_energy_kwh"] == pytest.approx(0.2, abs=0.001)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_unknown_model_uses_the_fallback_instead_of_zero(
        self, async_client: AsyncClient, archive_factory, printer_factory, db_session
    ):
        printer = await printer_factory(model="Something Unlisted")
        await archive_factory(printer.id, print_time_seconds=3600)
        await _use_estimated_mode(db_session)

        data = (await async_client.get("/api/v1/archives/stats")).json()

        assert data["total_energy_kwh"] == pytest.approx(FALLBACK_POWER_WATTS / 1000, abs=0.001)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_malformed_override_setting_does_not_break_stats(
        self, async_client: AsyncClient, archive_factory, printer_factory, db_session
    ):
        printer = await printer_factory(model="A1 Mini")
        await archive_factory(printer.id, print_time_seconds=3600)
        await set_setting(db_session, "energy_tracking_mode", "estimated")
        await set_setting(db_session, "printer_power_watts", "not json at all")
        await db_session.commit()

        response = await async_client.get("/api/v1/archives/stats")

        assert response.status_code == 200
        assert response.json()["total_energy_kwh"] == pytest.approx(
            DEFAULT_MODEL_POWER_WATTS["A1 Mini"] / 1000, abs=0.001
        )


class TestPowerOverrideSettingsRoundTrip:
    """The override map is stored as JSON, not as a Python repr."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_saving_overrides_through_the_api_reads_back_as_an_object(self, async_client: AsyncClient):
        response = await async_client.put(
            "/api/v1/settings/",
            json={"energy_tracking_mode": "estimated", "printer_power_watts": {"A1 Mini": 72.5}},
        )
        assert response.status_code == 200

        settings = (await async_client.get("/api/v1/settings/")).json()
        assert settings["energy_tracking_mode"] == "estimated"
        assert settings["printer_power_watts"] == {"A1 Mini": 72.5}

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_saved_override_is_applied_to_the_stats_estimate(
        self, async_client: AsyncClient, archive_factory, printer_factory
    ):
        printer = await printer_factory(model="A1 Mini")
        await archive_factory(printer.id, print_time_seconds=3600)

        await async_client.put(
            "/api/v1/settings/",
            json={
                "energy_tracking_mode": "estimated",
                "energy_cost_per_kwh": 0.20,
                "printer_power_watts": {"A1 Mini": 200},
            },
        )

        data = (await async_client.get("/api/v1/archives/stats")).json()

        assert data["total_energy_kwh"] == pytest.approx(0.2, abs=0.001)
        assert data["total_energy_cost"] == pytest.approx(0.04, abs=0.001)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_defaults_are_exposed_for_the_settings_ui(self, async_client: AsyncClient):
        settings = (await async_client.get("/api/v1/settings/")).json()

        assert settings["printer_power_watts_defaults"]["A1 Mini"] == DEFAULT_MODEL_POWER_WATTS["A1 Mini"]
        assert settings["printer_power_watts_fallback"] == FALLBACK_POWER_WATTS
