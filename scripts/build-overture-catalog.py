import argparse
import json
import unicodedata
from pathlib import Path


CITIES = {
    "cascavel": "Cascavel",
    "pindoretama": "Pindoretama",
    "aquiraz": "Aquiraz",
    "eusebio": "Eusébio",
}


def normalized(value):
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value or "").lower()
        if not unicodedata.combining(character)
    )


def matches_any(value, tokens):
    return any(token in value for token in tokens)


def segment_for(properties):
    taxonomy = properties.get("taxonomy") or {}
    primary = taxonomy.get("primary") or ""
    basic = properties.get("basic_category") or ""
    category = " ".join([primary, basic, *(taxonomy.get("hierarchy") or [])]).lower()

    if matches_any(category, ["clinic", "dentist", "dental", "hospital", "doctor", "physician", "veterinar", "medical_center", "diagnostic"]):
        return "Clínicas e consultórios"
    if matches_any(category, ["beauty_salon", "hair_salon", "barber", "spa", "massage", "nail_salon", "skin_care", "makeup"]):
        return "Estética e beleza"
    if matches_any(primary, ["restaurant", "cafe", "coffee_shop", "bar", "bakery", "ice_cream_shop", "food_court"]):
        return "Restaurantes"
    if matches_any(category, ["hotel", "lodging", "resort", "motel", "hostel", "guest_house", "bed_and_breakfast", "holiday_rental_home", "inn"]):
        return "Pousadas e hotéis"
    if "real_estate" in category:
        return "Imobiliárias"
    if matches_any(category, ["gym", "fitness", "sports_center", "sports_centre", "dance_studio", "martial_arts"]):
        return "Academias"
    if matches_any(primary, ["school", "college", "university", "education", "training_center", "language_school", "tutoring"]):
        return "Escolas e cursos"
    if matches_any(category, ["tourist_attraction", "museum", "theme_park", "water_park", "tour_operator", "travel_agency", "amusement_park", "zoo", "aquarium", "art_gallery"]):
        return "Turismo e experiências"
    if matches_any(category, ["automotive", "auto_parts", "car_dealer", "car_wash", "tire", "tyre", "motorcycle_dealer", "vehicle_repair"]):
        return "Serviços automotivos"
    if matches_any(category, ["_store", "shopping", "retail", "market", "mall"]):
        return "Lojas e comércio local"
    return None


def first(values):
    return next((value.strip() for value in values or [] if isinstance(value, str) and value.strip()), None)


def instagram(socials):
    return next((value for value in socials or [] if isinstance(value, str) and "instagram." in value.lower()), None)


def load_city(path, city):
    document = json.loads(path.read_text(encoding="utf-8"))
    results = []
    for feature in document.get("features", []):
        properties = feature.get("properties") or {}
        addresses = properties.get("addresses") or []
        address = addresses[0] if addresses else {}
        if normalized(address.get("locality")) != normalized(city):
            continue

        name = ((properties.get("names") or {}).get("primary") or "").strip()
        segment = segment_for(properties)
        phone = first(properties.get("phones"))
        website = first(properties.get("websites"))
        instagram_url = instagram(properties.get("socials"))
        coordinates = (feature.get("geometry") or {}).get("coordinates") or []
        if not name or not segment or not (phone or website or instagram_url) or len(coordinates) < 2:
            continue

        freeform = (address.get("freeform") or "").strip()
        results.append({
            "id": feature.get("id"),
            "name": name,
            "segment": segment,
            "city": city,
            "address": freeform or None,
            "phone": phone,
            "website": website,
            "instagram": instagram_url,
            "latitude": coordinates[1],
            "longitude": coordinates[0],
            "confidence": properties.get("confidence"),
        })
    return results


def main():
    parser = argparse.ArgumentParser(description="Compacta recortes oficiais do Overture Maps para o Perfect Prospect.")
    parser.add_argument("--input", default=".tmp-overture/raw")
    parser.add_argument("--output", default="server/search/data/overture-places.json")
    arguments = parser.parse_args()

    input_directory = Path(arguments.input)
    output_path = Path(arguments.output)
    catalog = []
    for file_stem, city in CITIES.items():
        catalog.extend(load_city(input_directory / f"{file_stem}.geojson", city))

    deduplicated = {}
    for place in catalog:
        key = (normalized(place["city"]), normalized(place["name"]), place.get("phone") or "")
        current = deduplicated.get(key)
        if current is None or (place.get("confidence") or 0) > (current.get("confidence") or 0):
            deduplicated[key] = place

    result = sorted(deduplicated.values(), key=lambda item: (item["city"], item["segment"], item["name"]))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    counts = {}
    for item in result:
        counts[item["city"]] = counts.get(item["city"], 0) + 1
    print(json.dumps({"total": len(result), "cities": counts, "bytes": output_path.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
