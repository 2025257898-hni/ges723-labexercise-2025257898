
(function () {
    "use strict";

    function setupGES723Fixes() {
        if (typeof map === "undefined" ||
            typeof L === "undefined") {
            console.error("GES723: Leaflet unavailable.");
            return;
        }

        // 04. Keep pump catchments transparent on hover
        const fixedPolygons = new WeakSet();
        let polygonCount = 0;

        function fixPolygon(layer) {
            if (!layer || fixedPolygons.has(layer)) {
                return;
            }

            const feature = layer.feature;

            if (
                feature &&
                feature.geometry &&
                /Polygon/.test(feature.geometry.type) &&
                feature.properties &&
                feature.properties.Deaths !== undefined &&
                typeof layer.setStyle === "function"
            ) {
                fixedPolygons.add(layer);

                // Remove qgis2web's opaque hover handler.
                if (typeof highlightFeature === "function") {
                    layer.off("mouseover", highlightFeature);
                }

                const normalStyle = {
                    fillOpacity: 0.50,
                    opacity: 0.65,
                    weight: 0.9
                };

                const hoverStyle = {
                    fillOpacity: 0.50,
                    opacity: 1,
                    weight: 2.2
                };

                layer.setStyle(normalStyle);

                layer.on("mouseover", function () {
                    layer.setStyle(hoverStyle);
                });

                layer.on("mouseout", function () {
                    layer.setStyle(normalStyle);
                });

                polygonCount++;
            }

            if (typeof layer.eachLayer === "function") {
                layer.eachLayer(fixPolygon);
            }
        }

        map.eachLayer(fixPolygon);

        // 05. Identify the exported pump vector layer
        function findGlobal(prefix) {
            const key = Object.keys(window).find(
                k => k.toLowerCase().startsWith(
                    prefix.toLowerCase()
                )
            );
            return key ? window[key] : null;
        }

        const pumpSource =
            window.layer_Waterpumps_0 ||
            findGlobal("layer_Waterpumps_");

        const pumpGeoJSON =
            window.json_Waterpumps_0 ||
            findGlobal("json_Waterpumps_");

        // 06. Collect all eight named pump locations
        let pumpFeatures = [];

        if (
            pumpGeoJSON &&
            Array.isArray(pumpGeoJSON.features)
        ) {
            pumpFeatures = pumpGeoJSON.features;
        } else if (
            pumpSource &&
            typeof pumpSource.eachLayer === "function"
        ) {
            pumpSource.eachLayer(function (layer) {
                if (layer.feature) {
                    pumpFeatures.push(layer.feature);
                }
            });
        }

        // 07. Prepare a dedicated high-priority label pane
        const labelPane = map.getPane("ges723PumpLabels") ||
            map.createPane("ges723PumpLabels");

        labelPane.style.zIndex = "850";
        labelPane.style.pointerEvents = "none";

        function escapeHTML(value) {
            return String(value).replace(/[&<>"']/g, c => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[c]);
        }

        // 08. Generate independent HTML pump labels
        const pumpLabels = L.layerGroup();
        let labelCount = 0;

        pumpFeatures.forEach(function (feature) {
            const p = feature.properties || {};
            const g = feature.geometry || {};
            const name = String(
                p.Name || p.name || ""
            ).trim();

            if (
                !name ||
                g.type !== "Point" ||
                !Array.isArray(g.coordinates)
            ) {
                return;
            }

            const lng = Number(g.coordinates[0]);
            const lat = Number(g.coordinates[1]);

            if (!Number.isFinite(lat) ||
                !Number.isFinite(lng)) {
                return;
            }

            const broad =
                name.toLowerCase() === "broad street";

            const cssClass = broad
                ? "ges723-pump-text broad"
                : "ges723-pump-text";

            const icon = L.divIcon({
                className: "ges723-pump-label-icon",
                html:
                    '<span class="' + cssClass + '">' +
                    escapeHTML(name) +
                    '</span>',
                iconSize: [1, 1],
                iconAnchor: [0, 0]
            });

            L.marker([lat, lng], {
                icon: icon,
                pane: "ges723PumpLabels",
                interactive: false,
                keyboard: false
            }).addTo(pumpLabels);

            labelCount++;
        });

        // 09. Synchronise labels with pump visibility
        let synchronising = false;

        function syncPumpLabels() {
            if (synchronising || !pumpSource) return;

            synchronising = true;

            const visible = map.hasLayer(pumpSource);

            if (visible && !map.hasLayer(pumpLabels)) {
                map.addLayer(pumpLabels);
            }

            if (!visible && map.hasLayer(pumpLabels)) {
                map.removeLayer(pumpLabels);
            }

            synchronising = false;
        }

        map.on("layeradd layerremove", syncPumpLabels);
        syncPumpLabels();

        // 10. Find the OpenStreetMap tile layer
        let osm =
            window.layer_OpenStreetMap_4 ||
            findGlobal("layer_OpenStreetMap_");

        if (!osm) {
            map.eachLayer(function (layer) {
                if (
                    layer instanceof L.TileLayer &&
                    /openstreetmap/i.test(
                        layer._url || ""
                    )
                ) {
                    osm = layer;
                }
            });
        }

        // 11. Add an independent basemap checkbox
        // A single base layer normally uses a radio button.
        if (osm) {
            const osmControl = L.control({
                position: "bottomright"
            });

            osmControl.onAdd = function () {
                const container = L.DomUtil.create(
                    "div",
                    "ges723-basemap-control"
                );

                const label = L.DomUtil.create(
                    "label",
                    "",
                    container
                );

                const checkbox = L.DomUtil.create(
                    "input",
                    "",
                    label
                );

                checkbox.type = "checkbox";
                checkbox.checked = map.hasLayer(osm);

                const caption = L.DomUtil.create(
                    "span",
                    "",
                    label
                );

                caption.textContent = " OpenStreetMap";

                L.DomEvent.disableClickPropagation(
                    container
                );

                L.DomEvent.disableScrollPropagation(
                    container
                );

                checkbox.addEventListener(
                    "change",
                    function () {
                        if (checkbox.checked) {
                            if (!map.hasLayer(osm)) {
                                osm.addTo(map);
                            }

                            if (osm.bringToBack) {
                                osm.bringToBack();
                            }
                        } else {
                            if (map.hasLayer(osm)) {
                                map.removeLayer(osm);
                            }
                        }
                    }
                );

                map.on("layeradd layerremove", function () {
                    checkbox.checked = map.hasLayer(osm);
                });

                return container;
            };

            osmControl.addTo(map);

            // 12. Hide the old single-choice OSM radio
            // The new checkbox replaces that control.
            document.querySelectorAll(
                ".leaflet-control-layers input[type=radio]"
            ).forEach(function (input) {
                const label = input.closest("label");

                if (
                    label &&
                    /OpenStreetMap/i.test(label.textContent)
                ) {
                    const li = label.closest("li");

                    if (
                        li &&
                        li.querySelectorAll("input").length === 1
                    ) {
                        li.style.display = "none";
                    } else {
                        label.style.display = "none";
                    }
                }
            });
        } else {
            console.warn(
                "GES723: OpenStreetMap tile layer not found."
            );
        }

        // 13. Preserve correct visual stacking
        Object.entries(map.getPanes()).forEach(
            function ([name, pane]) {
                const n = name.toLowerCase();

                if (n.includes("openstreetmap")) {
                    pane.style.zIndex = "200";
                } else if (n.includes("catchment")) {
                    pane.style.zIndex = "410";
                } else if (n.includes("cholera") ||
                           n.includes("deaths")) {
                    pane.style.zIndex = "480";
                } else if (n.includes("waterpump")) {
                    pane.style.zIndex = "520";
                }
            }
        );

        // 14. Report web map validation
        console.log(
            "GES723 FINAL FIXES LOADED",
            {
                pumps: labelCount,
                polygons: polygonCount,
                osmToggle: Boolean(osm),
                kdePreserved: true
            }
        );
    }

    // 15. Run after qgis2web and KDE enhancements
    if (document.readyState === "complete") {
        setupGES723Fixes();
    } else {
        window.addEventListener(
            "load",
            setupGES723Fixes,
            {once: true}
        );
    }
})();
