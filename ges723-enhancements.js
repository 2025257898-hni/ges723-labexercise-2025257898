
(function () {
    "use strict";

    const KDE = {"25": {"url": "kde/kde_25m.png", "bounds": [[51.51150399266798, -0.1405015375521266], [51.516152097440674, -0.1324157719579628]]}, "50": {"url": "kde/kde_50m.png", "bounds": [[51.511282805844026, -0.140870739967786], [51.51638247374896, -0.13204903956351463]]}, "100": {"url": "kde/kde_100m.png", "bounds": [[51.510816497669595, -0.14160913418422402], [51.516843223295474, -0.13131548681521604]]}};

    function initialiseGES723() {
        if (typeof L === "undefined" || typeof map === "undefined") {
            console.error("GES723: Leaflet map is unavailable.");
            return;
        }

        // 07. Correct web layer stacking order
        Object.entries(map.getPanes()).forEach(([name, pane]) => {
            const n = name.toLowerCase();

            if (n.includes("openstreetmap")) {
                pane.style.zIndex = 200;
            } else if (
                n.includes("catchment") ||
                n.includes("voronoi")
            ) {
                pane.style.zIndex = 410;
            } else if (n.includes("heatmap")) {
                pane.style.zIndex = 435;
            } else if (
                n.includes("cholera") ||
                n.includes("deaths")
            ) {
                pane.style.zIndex = 480;
            } else if (n.includes("pumps")) {
                pane.style.zIndex = 520;
            }
        });

        // 08. Create a dedicated pane for KDE rasters
        const kdePane = map.getPane("ges723KDE") ||
            map.createPane("ges723KDE");

        kdePane.style.zIndex = 435;
        kdePane.style.pointerEvents = "none";

        // 09. Create KDE raster overlays
        const kdeLayers = {};

        [25, 50, 100].forEach(radius => {
            const info = KDE[String(radius)];

            kdeLayers[radius] = L.imageOverlay(
                info.url,
                info.bounds,
                {
                    opacity: 0.55,
                    interactive: false,
                    pane: "ges723KDE"
                }
            );
        });

        let currentKDE = 50;
        let currentOpacity = 0.55;

        function showKDE(radius) {
            Object.values(kdeLayers).forEach(layer => {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            });

            currentKDE = Number(radius);

            if (currentKDE && kdeLayers[currentKDE]) {
                kdeLayers[currentKDE].setOpacity(currentOpacity);
                kdeLayers[currentKDE].addTo(map);
            }
        }

        // Show the analytical 50 m KDE by default
        showKDE(50);

        // 10. Create KDE controls
        const kdeControl = L.control({
            position: "bottomleft"
        });

        kdeControl.onAdd = function () {
            const box = L.DomUtil.create(
                "div",
                "ges723-kde-control"
            );

            box.innerHTML = `
                <div class="ges723-kde-title">
                    Cholera KDE
                </div>
                <div class="ges723-kde-subtitle">
                    Analytical raster · 1854
                </div>
                <label for="ges723-radius">Radius</label>
                <select id="ges723-radius">
                    <option value="0">Off</option>
                    <option value="25">25 metres</option>
                    <option value="50" selected>50 metres</option>
                    <option value="100">100 metres</option>
                </select>
                <label for="ges723-opacity">
                    Transparency / opacity
                </label>
                <input id="ges723-opacity"
                       type="range"
                       min="0"
                       max="100"
                       value="55">
                <span id="ges723-opacity-value">55%</span>
            `;

            L.DomEvent.disableClickPropagation(box);
            L.DomEvent.disableScrollPropagation(box);

            box.querySelector("#ges723-radius")
                .addEventListener("change", event => {
                    showKDE(event.target.value);
                });

            box.querySelector("#ges723-opacity")
                .addEventListener("input", event => {
                    currentOpacity = Number(event.target.value) / 100;

                    Object.values(kdeLayers).forEach(layer => {
                        layer.setOpacity(currentOpacity);
                    });

                    box.querySelector("#ges723-opacity-value")
                        .textContent = event.target.value + "%";
                });

            return box;
        };

        kdeControl.addTo(map);

        // 11. Escape popup/label text safely
        function escapeHTML(value) {
            return String(value).replace(/[&<>"']/g, c => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[c]);
        }

        // 12. Style vectors and add permanent water pump labels
        let labelCount = 0;
        const seen = new Set();

        function enhanceLayer(layer) {
            if (!layer || seen.has(layer)) return;
            seen.add(layer);

            const feature = layer.feature;

            if (feature && feature.properties) {
                const p = feature.properties;
                const geometry = feature.geometry || {};
                const type = geometry.type || "";

                // Pump catchments: retain graduated colours
                // while reducing polygon opacity
                if (
                    type.includes("Polygon") &&
                    p.Deaths !== undefined &&
                    typeof layer.setStyle === "function"
                ) {
                    layer.setStyle({
                        fillOpacity: 0.22,
                        opacity: 0.55,
                        weight: 0.9
                    });
                }

                // Death points: semi-transparent circles
                if (
                    type === "Point" &&
                    p.Count !== undefined &&
                    typeof layer.setStyle === "function"
                ) {
                    layer.setStyle({
                        fillOpacity: 0.66,
                        opacity: 0.9,
                        weight: 0.8
                    });
                }

                // Water pumps: permanent labels
                if (
                    type === "Point" &&
                    typeof p.Name === "string" &&
                    (layer instanceof L.Marker ||
                     layer instanceof L.CircleMarker)
                ) {
                    const name = p.Name.trim();
                    const broad =
                        name.toLowerCase() === "broad street";

                    if (name) {
                        layer.unbindTooltip();

                        layer.bindTooltip(
                            escapeHTML(name),
                            {
                                permanent: true,
                                direction: "top",
                                offset: [0, -8],
                                opacity: 1,
                                interactive: false,
                                className: broad
                                    ? "ges723-pump-label broad"
                                    : "ges723-pump-label"
                            }
                        );

                        if (typeof layer.setStyle === "function") {
                            layer.setStyle({
                                fillOpacity: 1,
                                opacity: 1
                            });
                        }

                        labelCount++;
                    }
                }
            }

            if (typeof layer.eachLayer === "function") {
                layer.eachLayer(enhanceLayer);
            }
        }

        map.eachLayer(enhanceLayer);

        // Reapply labels when users enable layers
        map.on("overlayadd", function () {
            seen.clear();
            labelCount = 0;
            map.eachLayer(enhanceLayer);
        });

        // 13. Set initial extent to the KDE study area
        const studyBounds = L.latLngBounds(KDE["50"].bounds);

        if (studyBounds.isValid()) {
            map.fitBounds(studyBounds.pad(0.12), {
                maxZoom: 17
            });
        } else {
            map.setView([51.5135, -0.1365], 17);
        }

        map.invalidateSize(true);

        console.log(
            "GES723 enhancements loaded. Pump labels:",
            labelCount
        );
    }

    // 14. Initialise after the generated page finishes loading
    if (document.readyState === "complete") {
        initialiseGES723();
    } else {
        window.addEventListener(
            "load",
            initialiseGES723,
            {once: true}
        );
    }
})();
