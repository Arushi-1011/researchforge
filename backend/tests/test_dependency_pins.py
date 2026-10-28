"""Regression checks for backend dependency constraints."""
from pathlib import Path
import tomllib


def test_starlette_pin_stays_fastapi_compatible() -> None:
    pyproject_path = Path(__file__).resolve().parents[1] / "pyproject.toml"
    dependencies = tomllib.loads(pyproject_path.read_text())["project"]["dependencies"]

    starlette_pin = next(dep for dep in dependencies if dep.startswith("starlette=="))
    assert starlette_pin.startswith("starlette==0.")
