"""Pre-flight environment check for the backend.

Two things can prevent the data stack from importing on a managed Windows
machine:

1. a missing dependency, and
2. Windows Application Control (WDAC / Smart App Control) blocking individual
   compiled ``.pyd`` / ``.dll`` files shipped inside wheels.

The second failure mode is transient: the policy verdict is granted per file
after the binary is seen a few times. This script reports the state of the ML
stack and, with ``--rounds``, repeatedly touches every compiled binary so the
policy can grant its verdicts.

Usage::

    python scripts/check_environment.py
    python scripts/check_environment.py --rounds 6 --sleep 20
"""

from __future__ import annotations

import argparse
import ctypes
import importlib
import pathlib
import sys
import time

REQUIRED_MODULES = (
    "numpy",
    "pandas",
    "scipy.spatial",
    "scipy.sparse",
    "sklearn.preprocessing",
    "sklearn.cluster",
    "sklearn.decomposition",
    "sklearn.metrics",
    "fastapi",
    "pydantic",
)

POLICY_MARKER = "Application Control policy"


def site_packages() -> pathlib.Path:
    return pathlib.Path(sys.executable).resolve().parent.parent / "Lib" / "site-packages"


def compiled_files() -> list[pathlib.Path]:
    root = site_packages()
    if not root.exists():  # pragma: no cover - non Windows layouts
        return []
    return sorted([*root.rglob("*.pyd"), *root.rglob("*.dll")])


def blocked_files() -> list[pathlib.Path]:
    """Return the compiled files the OS refuses to load for policy reasons."""

    blocked: list[pathlib.Path] = []
    for path in compiled_files():
        try:
            ctypes.WinDLL(str(path))
        except OSError as exc:
            if POLICY_MARKER in str(exc):
                blocked.append(path)
    return blocked


def check_imports() -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    for name in REQUIRED_MODULES:
        try:
            importlib.import_module(name)
            results.append((name, "ok"))
        except Exception as exc:  # noqa: BLE001 - diagnostics only
            first_line = str(exc).strip().splitlines()[0] if str(exc).strip() else exc.__class__.__name__
            results.append((name, f"{exc.__class__.__name__}: {first_line}"))
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rounds", type=int, default=1, help="How many times to retry blocked binaries")
    parser.add_argument("--sleep", type=float, default=15.0, help="Seconds between rounds")
    args = parser.parse_args()

    print(f"python: {sys.version.split()[0]}  executable: {sys.executable}")
    if sys.platform != "win32":
        print("Application Control checks only apply to Windows; skipping binary scan.")

    for round_index in range(1, args.rounds + 1):
        imports = check_imports()
        failures = [(name, detail) for name, detail in imports if detail != "ok"]
        blocked = blocked_files() if sys.platform == "win32" else []
        print(f"round {round_index}: {len(imports) - len(failures)}/{len(imports)} modules ok, {len(blocked)} blocked binaries")
        for name, detail in failures:
            print(f"  ! {name}: {detail}")
        if not failures:
            print("ML stack is healthy.")
            return 0
        if round_index < args.rounds:
            time.sleep(args.sleep)

    print("ML stack still degraded; rerun with more rounds if the blockers are policy verdicts.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
