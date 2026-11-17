const TREE_CO2_KG_PER_YEAR = 21.8
const BODY_MASS_KG = 70

// Active-mode profiles for calculating calories burned.
const ACTIVE_MODES = {
  walking: { met: 3.5, speedKmh: 4.8 },
  cycling: { met: 7.5, speedKmh: 15 }
}

/** Average tree-absorption time equivalent; this is not an offset claim. */
export function treeAbsorptionDays(co2Kg) {
  if (!Number.isFinite(co2Kg) || co2Kg <= 0) return 0
  return (co2Kg * 365) / TREE_CO2_KG_PER_YEAR
}

/** Estimated calories for an active-mode journey using a 70 kg adult profile. */
export function caloriesBurned(modeKey, distanceKm, bodyMassKg = BODY_MASS_KG) {
  const profile = ACTIVE_MODES[modeKey]
  if (
    !profile ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0 ||
    !Number.isFinite(bodyMassKg) ||
    bodyMassKg <= 0
  ) return 0

  return profile.met * bodyMassKg * (distanceKm / profile.speedKmh)
}
