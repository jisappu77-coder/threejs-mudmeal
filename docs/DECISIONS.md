# Decisions

## D001 — No physics dependency in first scaffold
Start with a lightweight arcade controller. Add Rapier only when collision and vehicle behavior prove that custom kinematics are insufficient.

## D002 — Compact prototype world
Validate riding and camera behavior before generating a larger city.

## D003 — Desktop controls first, shared gameplay later
Input is isolated so touch controls can feed the same motorcycle controller without duplicating gameplay logic.
