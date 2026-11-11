import { createStore } from "zustand/vanilla";
const assetsToLoad = [
  {
    id: "truck_chassis",
    path: "/models/truck/chassis.gltf",
    type: "model",
  },
  {
    id: "truck_wheel",
    path: "/models/truck/wheel.gltf",
    type: "model",
  },
  {
    id: "hatchback_chassis",
    path: "/models/hatchback/chassis.glb",
    type: "model",
  },
  {
    id: "hatchback_wheel",
    path: "/models/hatchback/wheel.glb",
    type: "model",
  },
  {
    id: "traffic_cone",
    path: "/models/traffic_cone.gltf",
    type: "model",
  },
  {
    id: "ramp",
    path: "/models/ramp.glb",
    type: "model",
  },
  {
    id: "vrControls",
    path: "/images/motion_controls.png",
    type: "texture",
  },
];

const assetStore = createStore((set) => ({
  assetsToLoad,
  loadedAssets: {},
  addLoadedAsset: (asset, id) =>
    set((state) => ({
      loadedAssets: {
        ...state.loadedAssets,
        [id]: asset,
      },
    })),
}));
export default assetStore;
