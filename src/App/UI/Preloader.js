import assetStore from "../Utils/AssetStore";
import { appStateStore } from "../Utils/Store";
import VehicleSelection from "./VehicleSelection";

export default class Preloader {
  constructor() {
    this.assetStore = assetStore;

    // Hiding the Screen before everything gets loaded
    this.overlay = document.querySelector(".overlay");
    this.loading = document.querySelector(".loading");
    this.controller = document.querySelector(".controller");
    this.keyboard = document.querySelector(".keyboard");

    // Vehicle selection screen, shown once everything is loaded
    this.selection = new VehicleSelection();

    this.assetStore.subscribe((state) => {
      this.numberOfLoadedAssets = Object.keys(state.loadedAssets).length;
      this.numberOfAssetsToLoad = state.assetsToLoad.length;
      this.progress = this.numberOfLoadedAssets / this.numberOfAssetsToLoad;

      document.getElementById("progressPercentage").innerHTML = Math.trunc(
        this.progress * 100
      );

      if (this.progress === 1) {
        appStateStore.setState({ assetsReady: true });
        this.loading.classList.add("fadeOut");
        window.setTimeout(() => this.ready(), 1200);
      }
    });
  }

  ready() {
    // Remove the loading element from DOM
    this.loading.remove();

    // Show the vehicle selection screen (CONFIRM starts the world)
    this.selection.show();
  }
}
