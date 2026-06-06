"""Smoke tests for a subset of simulation modes.

Coverage is intentionally partial: triangle, rope, and cloth are checked.
attraction and mesh3d have no tests, and nothing here exercises the HTTP API
(api/routes.py), the binary protocol (protocol/binary.py), or the WebSocket
interaction handler (api/websocket.py).
"""
from __future__ import annotations
import pytest

from backend.physics.engine import PhysicsEngine
from backend.modes.triangle import TriangleMode
from backend.modes.rope import RopeMode
from backend.modes.cloth import ClothMode


def test_triangle_setup():
    eng = PhysicsEngine()
    TriangleMode().setup(eng, {})
    assert eng.particles is not None
    assert eng.particles.count == 3
    assert eng.springs.count == 3
    assert eng.angle_constraints.count == 1


def test_rope_segment_count():
    eng = PhysicsEngine()
    RopeMode().setup(eng, {"num_segments": 10})
    assert eng.particles.count == 10
    assert eng.springs.count == 9


def test_cloth_particle_count():
    eng = PhysicsEngine()
    ClothMode().setup(eng, {"rows": 12, "cols": 12})
    assert eng.particles.count == 144


@pytest.mark.xfail(
    reason=(
        "Known gap: routes.get_current_mode reports num_springs as "
        "springs.count + distance_constraints.count, omitting angle_constraints. "
        "The README API spec says num_springs is the total connection count, so "
        "triangle should report 4 (3 springs + 1 angle constraint) but reports 3."
    ),
    strict=True,
)
def test_reported_spring_count_matches_total_connections():
    eng = PhysicsEngine()
    TriangleMode().setup(eng, {})
    reported = eng.springs.count + eng.distance_constraints.count
    total = (
        eng.springs.count
        + eng.distance_constraints.count
        + eng.angle_constraints.count
    )
    assert reported == total
