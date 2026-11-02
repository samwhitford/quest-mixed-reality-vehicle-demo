// Vehicle registry — the single source of truth for selectable vehicles.
//
// To add a new vehicle:
//   1. Register its model assets in AssetStore.js (e.g. "sportscarChassis").
//   2. Add an entry here with its asset ids, silhouette key and any
//      physics/spawn overrides in `config` (defaults live in Vehicle.js).
//   3. Set `available: true` once it's ready to drive.
// The selection screen, world build and rendering pipeline all read from
// this list, so nothing else needs to change.
export const VEHICLES = [
  {
    id: "truck",
    name: "Bruno's Truck",
    available: true,
    silhouette: "truck",
    config: {
      chassisAsset: "chassis",
      wheelAsset: "wheel",
      scaleFactor: 0.125,
      position: [0, 0.1, -1],
      wheelRestLength: 0.03,
      suspensionStiffness: 110,
      frictionSlip: 15,
      maxSuspensionTravel: 0.4,
      suspensionDamping: 20,
      chassisMass: 9,
    },
  },
  {
    id: "Kei",
    name: "Kei Truck",
    available: false,
    silhouette: "sedan",
  },
  {
    id: "Hatchback",
    name: "Hatchback",
    available: false,
    silhouette: "van",
  },
];

export function getVehicle(id) {
  return VEHICLES.find((vehicle) => vehicle.id === id);
}
