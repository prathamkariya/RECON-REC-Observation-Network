"""
Bounded-latency calls into teammate modules that reach the network.

A `with ThreadPoolExecutor(...)` block does NOT bound latency, which is the
trap this module exists to avoid: `__exit__` calls `shutdown(wait=True)`, so
even though `future.result(timeout=...)` raises on time, returning from inside
the `with` block then blocks until the worker actually finishes. A 3-second
timeout around a 30-second upstream call still took 30 seconds.

The pool here is module-level and never waited on, so a timed-out call is
genuinely abandoned: it keeps running in the background and its result is
dropped, while the caller gets control back at the deadline.
"""
import concurrent.futures
from typing import Callable, TypeVar

T = TypeVar("T")

# Bounded, so a burst of hung upstream calls can't spawn unlimited threads.
# When every worker is occupied, new submissions queue and hit their own
# deadline waiting — still bounded, still degrading to the caller's fallback.
_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=8, thread_name_prefix="upstream")


def call_with_deadline(fn: Callable[..., T], *args, timeout: float) -> T:
    """Run `fn(*args)`, raising `concurrent.futures.TimeoutError` if it has not
    returned within `timeout` seconds. Callers are expected to catch broadly
    and fall back — both a timeout and a genuine error mean "no usable answer".
    """
    future = _POOL.submit(fn, *args)
    try:
        return future.result(timeout=timeout)
    except concurrent.futures.TimeoutError:
        # Cancels only if it never started; an in-flight call is left to finish
        # and be discarded rather than waited on.
        future.cancel()
        raise
