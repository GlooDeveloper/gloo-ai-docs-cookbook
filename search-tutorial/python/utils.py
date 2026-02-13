def normalize_limit(value, fallback=10, minimum=1, maximum=100):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(parsed, maximum))
