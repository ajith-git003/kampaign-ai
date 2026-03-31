# Kampaign.ai — AI-native campaign engine
# Creative scoring service — sentence-transformers cosine similarity

import logging
from functools import lru_cache

import numpy as np

logger = logging.getLogger("kampaign.scoring")

# Reference phrases representative of high-performing ad copy — used as the "ideal" anchor
_REFERENCE_PHRASES = [
    "limited time offer — shop now",
    "proven results trusted by thousands",
    "transform your life today",
    "exclusive deal ends soon",
    "join over a million satisfied customers",
    "free shipping on all orders",
    "money-back guarantee — zero risk",
]


@lru_cache(maxsize=1)
def _get_model():
    """Lazy-load the sentence-transformers model — cached after first call."""
    from sentence_transformers import SentenceTransformer

    logger.info("Kampaign.ai | Loading sentence-transformer model (all-MiniLM-L6-v2)…")
    return SentenceTransformer("all-MiniLM-L6-v2")


def score_creative(headline: str, body: str = "") -> float:
    """
    Score ad creative quality as a float in [0, 1].
    Computes cosine similarity between the creative embedding and
    a set of reference high-performing phrases, then returns the mean.
    """
    try:
        model = _get_model()
        text = f"{headline}. {body}".strip(". ")
        creative_emb = model.encode([text])
        ref_emb = model.encode(_REFERENCE_PHRASES)

        # Normalise rows then dot-product for cosine similarity
        c_norm = creative_emb / np.linalg.norm(creative_emb, axis=1, keepdims=True)
        r_norm = ref_emb / np.linalg.norm(ref_emb, axis=1, keepdims=True)
        similarities = (c_norm @ r_norm.T)[0]

        score = float(np.mean(similarities))
        logger.debug(
            "Kampaign.ai | Creative score %.4f for headline: '%s'", score, headline[:60]
        )
        return round(max(0.0, min(1.0, score)), 4)
    except Exception as exc:
        logger.error("Kampaign.ai | Scoring failed: %s", exc)
        return 0.0
