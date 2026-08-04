"""
ZEfood Backend — Demand Prediction Service
Time-series forecasting for order volume using Prophet or fallback heuristics
"""
from __future__ import annotations
import logging
import math
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class DemandPredictor:
    """
    Predicts hourly order demand for a restaurant over the next N hours.

    Approach:
        1. Load historical order timestamps from Firestore
        2. Fit a Prophet model (or fallback sine-curve heuristic)
        3. Return hourly forecasts with peak-hour flags
        4. Generate plain-language alert messages for staff
    """

    # Average hourly demand curve (index = hour, value = relative demand)
    _BASE_CURVE = [
        0.2, 0.1, 0.05, 0.05, 0.05, 0.1,   # 0-5
        0.3, 0.6, 0.9, 0.7, 0.5, 0.8,       # 6-11
        1.0, 0.9, 0.6, 0.5, 0.4, 0.5,       # 12-17
        0.7, 0.9, 1.0, 0.8, 0.5, 0.3,       # 18-23
    ]

    def __init__(self):
        self._prophet_available = False
        self._restaurant_models = {}  # restaurant_id → fitted model

    def initialize(self) -> None:
        try:
            from prophet import Prophet  # noqa: F401
            self._prophet_available = True
            logger.info("✅ Prophet available for demand forecasting")
        except ImportError:
            logger.warning("Prophet not installed; using heuristic demand curve")

    def predict_demand(
        self,
        restaurant_id: str,
        historical_orders: list[dict],
        horizon_hours: int = 24,
    ) -> dict:
        """
        Predict hourly order demand.

        Args:
            restaurant_id: target restaurant
            historical_orders: list of order dicts with 'created_at' timestamps
            horizon_hours: how many hours ahead to forecast

        Returns:
            DemandForecast-compatible dict
        """
        now = datetime.now(timezone.utc)
        current_hour = now.hour

        if self._prophet_available and len(historical_orders) >= 30:
            hourly = self._prophet_predict(historical_orders, current_hour, horizon_hours)
        else:
            hourly = self._heuristic_predict(historical_orders, current_hour, horizon_hours)

        peak_hours = [h["hour"] for h in hourly if h["is_peak"]]
        alert_message = self._generate_alert(peak_hours, current_hour)

        return {
            "restaurant_id": restaurant_id,
            "date": now.strftime("%Y-%m-%d"),
            "hourly": hourly,
            "peak_hours": peak_hours,
            "alert_message": alert_message,
        }

    # ── Prediction methods ────────────────────────────────

    def _heuristic_predict(
        self, historical_orders: list[dict], current_hour: int, horizon: int
    ) -> list[dict]:
        """Sine-curve heuristic adjusted by observed order volume."""
        # Compute observed hourly counts from history
        observed_counts = [0] * 24
        for order in historical_orders:
            ts = order.get("created_at")
            if isinstance(ts, datetime):
                observed_counts[ts.hour] += 1

        total_observed = sum(observed_counts)
        daily_avg = total_observed / max(len(set(
            o.get("created_at", datetime.now()).date() for o in historical_orders if o.get("created_at")
        )), 1)

        result = []
        for i in range(horizon):
            h = (current_hour + i) % 24
            base = self._BASE_CURVE[h]
            scale = max(daily_avg, 10)  # at least 10 orders/day for display
            expected = max(1, int(base * scale))
            is_peak = base >= 0.8
            result.append({"hour": h, "expected_orders": expected, "is_peak": is_peak})
        return result

    def _prophet_predict(
        self, historical_orders: list[dict], current_hour: int, horizon: int
    ) -> list[dict]:
        """Prophet-based time-series forecast."""
        try:
            import pandas as pd
            from prophet import Prophet

            # Build dataframe
            timestamps = []
            for o in historical_orders:
                ts = o.get("created_at")
                if isinstance(ts, datetime):
                    timestamps.append(ts.replace(tzinfo=None))

            if not timestamps:
                return self._heuristic_predict(historical_orders, current_hour, horizon)

            df = pd.DataFrame({"ds": timestamps, "y": [1] * len(timestamps)})
            df = df.set_index("ds").resample("H").sum().reset_index()

            model = Prophet(
                seasonality_mode="multiplicative",
                daily_seasonality=True,
                weekly_seasonality=True,
            )
            model.fit(df)

            future = model.make_future_dataframe(periods=horizon, freq="H")
            forecast = model.predict(future)

            # Extract next `horizon` hours
            tail = forecast.tail(horizon)
            result = []
            for _, row in tail.iterrows():
                h = row["ds"].hour
                expected = max(0, int(row["yhat"]))
                # Peak if > 75th percentile
                is_peak = row["yhat"] > forecast["yhat"].quantile(0.75)
                result.append({"hour": h, "expected_orders": expected, "is_peak": bool(is_peak)})
            return result

        except Exception as e:
            logger.error(f"Prophet prediction failed: {e}; falling back to heuristic")
            return self._heuristic_predict(historical_orders, current_hour, horizon)

    def _generate_alert(self, peak_hours: list[int], current_hour: int) -> Optional[str]:
        """Generate a human-readable staff alert message."""
        upcoming_peaks = [h for h in peak_hours if h > current_hour and h <= current_hour + 3]
        if not upcoming_peaks:
            return None
        h = upcoming_peaks[0]
        ampm = "AM" if h < 12 else "PM"
        display_h = h if h <= 12 else h - 12
        return (
            f"⚡ High order volume expected around {display_h}:00 {ampm}. "
            f"Consider prepping additional stock and ensuring full staff coverage."
        )


# Singleton
demand_predictor = DemandPredictor()
