"""Approximate geographic centroids for Karnataka districts.

The FIR data has no lat/long, only district names. These centroids let the
frontend plot district-level risk on a map. Coordinates are approximate
administrative centres (decimal degrees) and are matched to the seeded
district names (the part before any parenthetical).
"""

DISTRICT_CENTROIDS: dict[str, tuple[float, float]] = {
    "Bengaluru Urban": (12.9716, 77.5946),
    "Bengaluru Rural": (13.2846, 77.6900),
    "Mysuru": (12.2958, 76.6394),
    "Mangaluru (Dakshina Kannada)": (12.9141, 74.8560),
    "Belagavi": (15.8497, 74.4977),
    "Kalaburagi": (17.3297, 76.8343),
    "Hubballi-Dharwad": (15.3647, 75.1240),
    "Tumakuru": (13.3379, 77.1173),
    "Shivamogga": (13.9299, 75.5681),
    "Davanagere": (14.4644, 75.9218),
    "Ballari": (15.1394, 76.9214),
    "Vijayapura": (16.8302, 75.7100),
    "Raichur": (16.2076, 77.3463),
    "Hassan": (13.0072, 76.0962),
    "Mandya": (12.5223, 76.8954),
    "Udupi": (13.3409, 74.7421),
    "Chitradurga": (14.2251, 76.3980),
    "Kolar": (13.1367, 78.1292),
    "Bagalkote": (16.1691, 75.6615),
    "Chikkamagaluru": (13.3161, 75.7720),
    "Bidar": (17.9104, 77.5199),
    "Koppal": (15.3500, 76.1547),
    "Gadag": (15.4316, 75.6355),
    "Haveri": (14.7935, 75.4044),
    "Chamarajanagara": (11.9261, 76.9437),
    "Yadgir": (16.7700, 77.1376),
    "Ramanagara": (12.7217, 77.2807),
    "Chikkaballapura": (13.4355, 77.7315),
    "Kodagu": (12.3375, 75.8069),
    "Uttara Kannada": (14.7937, 74.6869),
}

# Karnataka bounding box for normalizing coordinates to an SVG viewport.
KARNATAKA_BOUNDS = {
    "min_lat": 11.5,
    "max_lat": 18.5,
    "min_lng": 74.0,
    "max_lng": 78.6,
}


def centroid_for(name: str) -> tuple[float, float] | None:
    if name in DISTRICT_CENTROIDS:
        return DISTRICT_CENTROIDS[name]
    # Tolerate names with a parenthetical suffix or minor variations.
    base = name.split(" (")[0].strip()
    for key, coords in DISTRICT_CENTROIDS.items():
        if key.split(" (")[0].strip() == base:
            return coords
    return None
