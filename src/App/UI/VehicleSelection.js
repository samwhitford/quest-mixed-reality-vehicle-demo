import { appStateStore } from "../Utils/Store.js";
import { VEHICLES } from "../World/vehicles.js";
import { SILHOUETTES } from "./Silhouettes.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Vehicle selection screen shown after the preloader finishes.
// Drives the .selection UI in index.html: left/right navigation between the
// vehicles registered in World/vehicles.js, placeholder silhouettes for
// unavailable entries and a CONFIRM action that kicks off the world build.
export default class VehicleSelection {
  constructor() {
    this.vehicles = VEHICLES;
    // Start on the first available vehicle (falls back to the first entry).
    this.index = Math.max(
      0,
      this.vehicles.findIndex((vehicle) => vehicle.available)
    );
    this.visible = false;
    this.confirmed = false;

    this.overlay = document.querySelector(".overlay");
    this.root = document.querySelector(".selection");
    this.nameEl = document.querySelector(".selection-name");
    this.statusEl = document.querySelector(".selection-status");
    this.silhouetteEl = document.querySelector(".silhouette");
    this.confirmBtn = document.querySelector(".confirm");
    this.dotsEl = document.querySelector(".selection-dots");
    this.leftBtn = document.querySelector(".selection-nav-left");
    this.rightBtn = document.querySelector(".selection-nav-right");
    this.controller = document.querySelector(".controller");
    this.keyboard = document.querySelector(".keyboard");

    this.leftBtn.addEventListener("click", () => {
      this.navigate(-1);
      this.blurActive();
    });
    this.rightBtn.addEventListener("click", () => {
      this.navigate(1);
      this.blurActive();
    });
    this.confirmBtn.addEventListener("click", () => {
      this.confirm();
      this.blurActive();
    });
    window.addEventListener("keydown", this.onKeyDown);
    this.render();
  }

  current() {
    return this.vehicles[this.index];
  }

  blurActive() {
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  show() {
    this.visible = true;
    this.root.style.display = "flex";
    this.root.classList.add("fadeIn");
    this.controller.style.display = "inline";
    this.controller.classList.add("fadeIn");
    this.keyboard.style.display = "inline";
    this.keyboard.classList.add("fadeIn");
  }

  navigate(delta) {
    if (this.confirmed) return;
    this.index =
      (this.index + delta + this.vehicles.length) % this.vehicles.length;
    this.render();
  }

  onKeyDown = (event) => {
    if (!this.visible || this.confirmed) return;
    const { key } = event;
    if (
      key === "ArrowLeft" ||
      key === "ArrowRight" ||
      key === "Enter" ||
      key === " "
    ) {
      // Prevent a focused button from also firing its click on Enter/Space.
      this.blurActive();
      event.preventDefault();
    }
    if (key === "ArrowLeft") this.navigate(-1);
    else if (key === "ArrowRight") this.navigate(1);
    else if (key === "Enter" || key === " ") this.confirm();
  };

  render() {
    const vehicle = this.current();
    const silhouette = SILHOUETTES[vehicle.silhouette] || SILHOUETTES.truck;

    this.silhouetteEl.innerHTML = "";
    this.silhouetteEl.setAttribute("viewBox", silhouette.viewBox);
    this.silhouetteEl.classList.toggle("prebuilt", Boolean(silhouette.inner));
    if (silhouette.inner) {
      this.silhouetteEl.innerHTML = silhouette.inner;
    } else {
      const body = document.createElementNS(SVG_NS, "path");
      body.setAttribute("d", silhouette.body);
      this.silhouetteEl.appendChild(body);
      silhouette.wheels.forEach(([cx, cy, r]) => {
        const wheel = document.createElementNS(SVG_NS, "circle");
        wheel.setAttribute("cx", cx);
        wheel.setAttribute("cy", cy);
        wheel.setAttribute("r", r);
        this.silhouetteEl.appendChild(wheel);
      });
    }

    this.root.classList.toggle("unavailable", !vehicle.available);
    this.nameEl.textContent = vehicle.name.toUpperCase();
    this.statusEl.textContent = vehicle.available
      ? "AVAILABLE"
      : "COMING SOON";
    this.confirmBtn.disabled = !vehicle.available;

    this.dotsEl.innerHTML = "";
    this.vehicles.forEach((v, i) => {
      const dot = document.createElement("span");
      dot.className = i === this.index ? "dot active" : "dot";
      this.dotsEl.appendChild(dot);
    });
  }

  confirm() {
    if (this.confirmed || !this.visible) return;
    const vehicle = this.current();
    if (!vehicle.available) return;
    this.confirmed = true;
    window.removeEventListener("keydown", this.onKeyDown);

    this.overlay.classList.add("fadeOut");
    this.root.classList.add("fadeOut");
    this.controller.classList.add("fadeOut");
    this.keyboard.classList.add("fadeOut");
    setTimeout(() => {
      [this.overlay, this.root, this.controller, this.keyboard].forEach(
        (el) => el && el.remove()
      );
    }, 2000);

    // World builds itself once it sees this (see World.js); RATK follows on
    // worldReady, and the Renderer creates the ENTER XR button off pressedStart.
    appStateStore.setState({
      pressedStart: true,
      confirmedVehicle: vehicle.id,
    });
  }
}
