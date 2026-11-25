"""Límite de intentos fallidos de inicio de sesión (en memoria, un proceso)."""

import time
from collections import defaultdict, deque
from threading import Lock

MAX_FAILURES = 5
WINDOW_SECONDS = 300


class LoginLimiter:
    def __init__(self, max_failures: int = MAX_FAILURES, window: float = WINDOW_SECONDS) -> None:
        self.max_failures = max_failures
        self.window = window
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._failures[key]
        while attempts and now - attempts[0] > self.window:
            attempts.popleft()
        return attempts

    def retry_after(self, key: str) -> int:
        """Segundos que faltan para poder intentarlo de nuevo (0 si se puede ya)."""
        now = time.monotonic()
        with self._lock:
            attempts = self._prune(key, now)
            if len(attempts) < self.max_failures:
                return 0
            return max(1, int(self.window - (now - attempts[0])) + 1)

    def fail(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


login_limiter = LoginLimiter()
