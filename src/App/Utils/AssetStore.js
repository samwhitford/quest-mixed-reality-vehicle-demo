import { createStore } from "zustand/vanilla";
const assetsToLoad = [
  {
    id: "chassis",
    path: "/models/truck/chassis.gltf",
    type: "model",
  },
  {
    id: "wheel",
    path: "/models/truck/wheel.gltf",
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
