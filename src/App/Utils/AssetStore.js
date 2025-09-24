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
];

// addLoad function is just adding assets to loadedAssets object once they are loaded
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
