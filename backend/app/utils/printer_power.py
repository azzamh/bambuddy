"""Average power draw per printer model, used to estimate energy without a plug.

Smart plugs give measured energy, but most fleets only have plugs on a few
printers (or none). These figures let the stats page estimate energy from
``print duration x average draw`` instead of reporting zero.

The numbers are *average* draw across a print, not nameplate or peak power.
Peak draw is far higher — bed and chamber heat-up pull several hundred watts —
but that only lasts minutes, so using peak would badly overstate a long print.
They are deliberately conservative starting points: a user who measures their
own printer can override any model in Settings.
"""

# Normalized model name (see printer_models.PRINTER_MODEL_MAP) -> average watts
DEFAULT_MODEL_POWER_WATTS: dict[str, float] = {
    # A series — open frame, no chamber heater, small beds
    "A1 Mini": 65.0,
    "A1": 100.0,
    # P series — enclosed, larger bed
    "P1P": 105.0,
    "P1S": 120.0,
    "P2S": 130.0,
    # X series — enclosed with active chamber control
    "X1": 130.0,
    "X1C": 140.0,
    "X1E": 150.0,
    "X2D": 150.0,
    # H series — largest beds, dual nozzle on the D/Pro variants
    "H2S": 160.0,
    "H2D": 180.0,
    "H2D Pro": 190.0,
    "H2C": 190.0,
}

# Used when a printer's model is unknown or missing from the table above.
FALLBACK_POWER_WATTS = 120.0


def resolve_power_watts(model: str | None, overrides: dict[str, float] | None = None) -> float:
    """Average watts to assume for one printer model.

    User overrides win, then the built-in table, then the fallback. Model
    matching ignores case and spacing so "a1 mini", "A1 Mini" and "A1Mini"
    all resolve to the same entry.
    """

    def normalize(name: str) -> str:
        return name.replace(" ", "").replace("-", "").upper()

    if not model:
        return FALLBACK_POWER_WATTS

    key = normalize(model)

    for source in (overrides or {}, DEFAULT_MODEL_POWER_WATTS):
        for candidate, watts in source.items():
            if normalize(candidate) == key:
                try:
                    value = float(watts)
                except (TypeError, ValueError):
                    continue
                if value > 0:
                    return value

    return FALLBACK_POWER_WATTS


def estimate_kwh(model: str | None, seconds: float | None, overrides: dict[str, float] | None = None) -> float:
    """Energy a print of ``seconds`` would use on ``model``, in kWh."""
    if not seconds or seconds <= 0:
        return 0.0
    return resolve_power_watts(model, overrides) * (seconds / 3600.0) / 1000.0
