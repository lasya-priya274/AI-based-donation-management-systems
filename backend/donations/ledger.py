"""Hash-chained ledger: the DLT layer.

Every donation / expenditure / review is appended as a block that commits to the
previous block's hash, so editing any past record breaks every later hash and is
detected by `verify()`. This is a single-node permissioned ledger; the same
interface can later be backed by Hyperledger/Ethereum.
"""
import hashlib
import json
from django.db import transaction
from django.utils import timezone

from .models import Block

GENESIS_PREV = "0" * 64


def compute_hash(index, timestamp, kind, payload, prev_hash):
    body = json.dumps(
        {"i": index, "t": timestamp, "k": kind, "p": payload, "h": prev_hash},
        sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()


def pseudonym(user_id):
    """Donor identity on-chain is a salted hash, not the username."""
    return hashlib.sha256(f"donor:{user_id}".encode()).hexdigest()[:12]


@transaction.atomic
def append(kind, payload):
    last = Block.objects.select_for_update().order_by("-index").first()
    if last is None:
        last = _genesis()
    index = last.index + 1
    ts = timezone.now().isoformat()
    h = compute_hash(index, ts, kind, payload, last.hash)
    return Block.objects.create(index=index, timestamp=ts, kind=kind, payload=payload,
                                prev_hash=last.hash, hash=h)


def _genesis():
    ts = timezone.now().isoformat()
    payload = {"note": "genesis"}
    h = compute_hash(0, ts, "genesis", payload, GENESIS_PREV)
    return Block.objects.create(index=0, timestamp=ts, kind="genesis", payload=payload,
                                prev_hash=GENESIS_PREV, hash=h)


def verify():
    """Re-compute the whole chain. Returns {valid, length, broken_at}."""
    prev = GENESIS_PREV
    n = 0
    for b in Block.objects.order_by("index").iterator():
        if b.prev_hash != prev or compute_hash(b.index, b.timestamp, b.kind, b.payload, b.prev_hash) != b.hash:
            return {"valid": False, "length": n, "broken_at": b.index}
        prev = b.hash
        n += 1
    return {"valid": True, "length": n, "broken_at": None}
