
// Is this the loading screen? might need a more UI focused name
import assetStore from "../Utils/AssetStore";
import { appStateStore } from "../Utils/Store";

export default class Preloader {
  constructor() {
    this.assetStore = assetStore;

    // Hiding the Screen before everything gets loaded
    this.overlay = document.querySelector(".overlay");
    this.loading = document.querySelector(".loading");
    this.startButton = document.querySelector(".start");
    this.controller = document.querySelector(".controller");
    this.keyboard = document.querySelector(".keyboard");

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

    this.startButton.style.display = "inline";
    this.startButton.classList.add("fadeIn");
    this.controller.style.display = "inline";
    this.controller.classList.add("fadeIn");
    this.keyboard.style.display = "inline";
    this.keyboard.classList.add("fadeIn");

    this.startButton.addEventListener(
      "click",
      () => {
        this.overlay.classList.add("fadeOut");
        this.startButton.classList.add("fadeOut");
        this.controller.classList.add("fadeOut");
        this.keyboard.classList.add("fadeOut");

        // Remove the overlay and startButton element from DOM
        window.setTimeout(() => {
          this.overlay.remove();
          this.startButton.remove();
          this.controller.remove();
          this.keyboard.remove();
        }, 2000);
        appStateStore.setState({ pressedStart: true });
      },
      { once: true }
    );
  }
}
