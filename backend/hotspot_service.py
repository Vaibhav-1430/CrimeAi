"""Crime hotspot prediction & forecasting.

Pipeline:
  1. Pull FIRs (read-only) into a pandas frame.
  2. Aggregate to a district x month panel of crime counts.
  3. Engineer lag / rolling / trend features.
  4. Train a RandomForest to score each district's next-month risk and an
     XGBoost regressor to forecast the next N months of total crime volume.

Models are trained on demand from live data and cached briefly, so the module
stays read-only and needs no model files on disk. If there is too little data
to train, it degrades to trend-based estimates rather than failing.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sqlalchemy import text
from sqlalchemy.orm import Session
from xgboost import XGBRegressor

from karnataka_geo import KARNATAKA_BOUNDS, centroid_for

_CACHE: dict[str, tuple[float, object]] = {}
_CACHE_TTL = 600  # seconds


def _cache_get(key: str):
    entry = _CACHE.get(key)
    if entry and entry[0] > time.time():
        return entry[1]
    return None


def _cache_set(key: str, value) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL, value)


def _load_frame(db: Session) -> pd.DataFrame:
    """FIRs joined to district names as a pandas DataFrame (read-only)."""
    rows = db.execute(
        text(
            "SELECT f.id, f.crime_type, f.status, f.incident_date, d.name AS district "
            "FROM firs f JOIN districts d ON d.id = f.district_id "
            "WHERE f.incident_date IS NOT NULL"
        )
    ).all()
    df = pd.DataFrame(rows, columns=["id", "crime_type", "status", "incident_date", "district"])
    df["incident_date"] = pd.to_datetime(df["incident_date"])
    df["month"] = df["incident_date"].dt.to_period("M").dt.to_timestamp()
    return df


def _district_month_panel(df: pd.DataFrame) -> pd.DataFrame:
    """A complete district x month panel of counts (zero-filled gaps)."""
    counts = df.groupby(["district", "month"]).size().reset_index(name="count")
    districts = counts["district"].unique()
    months = pd.date_range(counts["month"].min(), counts["month"].max(), freq="MS")
    full_index = pd.MultiIndex.from_product([districts, months], names=["district", "month"])
    panel = counts.set_index(["district", "month"]).reindex(full_index, fill_value=0).reset_index()
    return panel.sort_values(["district", "month"])


def _build_features(panel: pd.DataFrame) -> pd.DataFrame:
    """Lag / rolling / trend features per district for supervised learning."""
    panel = panel.copy()
    grp = panel.groupby("district")["count"]
    panel["lag_1"] = grp.shift(1)
    panel["lag_2"] = grp.shift(2)
    panel["lag_3"] = grp.shift(3)
    panel["roll_3"] = grp.shift(1).rolling(3).mean().reset_index(0, drop=True)
    panel["roll_6"] = grp.shift(1).rolling(6).mean().reset_index(0, drop=True)
    panel["month_num"] = panel["month"].dt.month
    panel["trend"] = panel.groupby("district").cumcount()
    return panel


FEATURES = ["lag_1", "lag_2", "lag_3", "roll_3", "roll_6", "month_num", "trend"]


@dataclass
class HotspotResult:
    heatmap: list[dict]
    risk_ranking: list[dict]
    monthly: list[dict]
    kpis: dict


@dataclass
class ForecastResult:
    history: list[dict]
    forecast: list[dict]
    model: str
    district: str | None


def compute_hotspots(db: Session) -> HotspotResult:
    cached = _cache_get("hotspots")
    if cached:
        return cached

    df = _load_frame(db)
    panel = _district_month_panel(df)
    feat = _build_features(panel).dropna(subset=FEATURES)

    # Train RandomForest to predict next-month count, then score the latest
    # observed row per district as its forward-looking risk.
    risk_by_district: dict[str, float] = {}
    if len(feat) >= 30:
        model = RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1)
        model.fit(feat[FEATURES], feat["count"])
        latest = feat.sort_values("month").groupby("district").tail(1)
        preds = model.predict(latest[FEATURES])
        for district, pred in zip(latest["district"], preds):
            risk_by_district[district] = float(max(pred, 0))
    else:
        # Fallback: recent 3-month average.
        latest = panel.groupby("district").tail(3)
        for district, grp in latest.groupby("district"):
            risk_by_district[district] = float(grp["count"].mean())

    # Totals and trend per district for ranking/heatmap.
    totals = df.groupby("district").size().to_dict()
    recent_cutoff = df["month"].max() - pd.DateOffset(months=3)
    recent = df[df["month"] > recent_cutoff].groupby("district").size().to_dict()
    prior = (
        df[(df["month"] <= recent_cutoff) & (df["month"] > recent_cutoff - pd.DateOffset(months=3))]
        .groupby("district")
        .size()
        .to_dict()
    )

    max_risk = max(risk_by_district.values()) if risk_by_district else 1.0
    heatmap: list[dict] = []
    ranking: list[dict] = []
    for district, risk in risk_by_district.items():
        coords = centroid_for(district)
        score = round(100 * risk / max_risk, 1) if max_risk else 0.0
        recent_n = recent.get(district, 0)
        prior_n = prior.get(district, 0)
        trend_pct = round(100 * (recent_n - prior_n) / prior_n, 1) if prior_n else 0.0
        entry = {
            "district": district,
            "risk_score": score,
            "predicted_next_month": round(risk, 1),
            "total_firs": int(totals.get(district, 0)),
            "recent_3m": int(recent_n),
            "trend_pct": trend_pct,
            "risk_level": _risk_level(score),
            "lat": coords[0] if coords else None,
            "lng": coords[1] if coords else None,
        }
        ranking.append(entry)
        if coords:
            heatmap.append(
                {
                    "district": district,
                    "lat": coords[0],
                    "lng": coords[1],
                    "risk_score": score,
                    "x": _norm_lng(coords[1]),
                    "y": _norm_lat(coords[0]),
                }
            )

    ranking.sort(key=lambda r: r["risk_score"], reverse=True)

    monthly = (
        df.groupby("month").size().reset_index(name="count").sort_values("month")
    )
    monthly_out = [
        {"month": m.strftime("%Y-%m"), "count": int(c)}
        for m, c in zip(monthly["month"], monthly["count"])
    ]

    kpis = {
        "total_firs": int(len(df)),
        "districts_tracked": int(df["district"].nunique()),
        "high_risk_districts": int(sum(1 for r in ranking if r["risk_level"] == "High")),
        "top_district": ranking[0]["district"] if ranking else None,
        "months_of_data": int(df["month"].nunique()),
    }

    result = HotspotResult(heatmap=heatmap, risk_ranking=ranking, monthly=monthly_out, kpis=kpis)
    _cache_set("hotspots", result)
    return result


def forecast(db: Session, district: str | None = None, horizon: int = 6, model_name: str = "xgboost") -> ForecastResult:
    cache_key = f"forecast::{district}::{horizon}::{model_name}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    df = _load_frame(db)
    if district:
        df = df[df["district"] == district]

    series = (
        df.groupby("month").size().reset_index(name="count").sort_values("month")
    )
    if series.empty:
        return ForecastResult(history=[], forecast=[], model=model_name, district=district)

    # Build a single-series supervised frame with lag/rolling/trend features.
    s = series.set_index("month")["count"].asfreq("MS", fill_value=0)
    frame = pd.DataFrame({"count": s})
    frame["lag_1"] = frame["count"].shift(1)
    frame["lag_2"] = frame["count"].shift(2)
    frame["lag_3"] = frame["count"].shift(3)
    frame["roll_3"] = frame["count"].shift(1).rolling(3).mean()
    frame["month_num"] = frame.index.month
    frame["trend"] = range(len(frame))
    train = frame.dropna()

    feat_cols = ["lag_1", "lag_2", "lag_3", "roll_3", "month_num", "trend"]
    used_model = model_name
    if len(train) >= 8:
        if model_name == "random_forest":
            est = RandomForestRegressor(n_estimators=200, max_depth=6, random_state=42, n_jobs=-1)
        else:
            est = XGBRegressor(
                n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.9, random_state=42
            )
            used_model = "xgboost"
        est.fit(train[feat_cols], train["count"])
        forecast_points = _roll_forward(frame, est, feat_cols, horizon)
    else:
        # Too little data: linear trend extrapolation.
        used_model = "linear_trend"
        forecast_points = _linear_forecast(s, horizon)

    history = [
        {"month": idx.strftime("%Y-%m"), "count": int(val)} for idx, val in s.items()
    ]
    result = ForecastResult(history=history, forecast=forecast_points, model=used_model, district=district)
    _cache_set(cache_key, result)
    return result


def _roll_forward(frame: pd.DataFrame, est, feat_cols: list[str], horizon: int) -> list[dict]:
    """Iteratively predict each future month, feeding predictions back as lags."""
    counts = list(frame["count"].values)
    last_month = frame.index[-1]
    trend = len(frame)
    points: list[dict] = []
    for step in range(1, horizon + 1):
        next_month = last_month + pd.DateOffset(months=step)
        lag_1 = counts[-1]
        lag_2 = counts[-2] if len(counts) >= 2 else lag_1
        lag_3 = counts[-3] if len(counts) >= 3 else lag_2
        roll_3 = float(np.mean(counts[-3:])) if len(counts) >= 3 else float(np.mean(counts))
        row = pd.DataFrame(
            [[lag_1, lag_2, lag_3, roll_3, next_month.month, trend + step]], columns=feat_cols
        )
        pred = float(max(est.predict(row)[0], 0))
        counts.append(pred)
        points.append({"month": next_month.strftime("%Y-%m"), "count": round(pred, 1), "forecast": True})
    return points


def _linear_forecast(s: pd.Series, horizon: int) -> list[dict]:
    x = np.arange(len(s))
    coeffs = np.polyfit(x, s.values, 1)
    last_month = s.index[-1]
    points = []
    for step in range(1, horizon + 1):
        val = max(coeffs[0] * (len(s) + step - 1) + coeffs[1], 0)
        next_month = last_month + pd.DateOffset(months=step)
        points.append({"month": next_month.strftime("%Y-%m"), "count": round(float(val), 1), "forecast": True})
    return points


def _risk_level(score: float) -> str:
    if score >= 66:
        return "High"
    if score >= 33:
        return "Medium"
    return "Low"


def _norm_lng(lng: float) -> float:
    b = KARNATAKA_BOUNDS
    return round(100 * (lng - b["min_lng"]) / (b["max_lng"] - b["min_lng"]), 2)


def _norm_lat(lat: float) -> float:
    # Inverted so north is up in SVG (y grows downward).
    b = KARNATAKA_BOUNDS
    return round(100 * (b["max_lat"] - lat) / (b["max_lat"] - b["min_lat"]), 2)
