
(function () {
    "use strict";

    function setupLabelToggle() {
        if (document.getElementById("ges723-label-checkbox")) {
            return;
        }

        // 04. Create the pump label checkbox
        const label = document.createElement("label");
        label.className = "ges723-label-toggle-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = "ges723-label-checkbox";
        checkbox.checked = true;

        const caption = document.createElement("span");
        caption.textContent = "Pump labels";

        label.appendChild(checkbox);
        label.appendChild(caption);

        // 05. Hide/show labels without hiding pump symbols
        function updateLabels() {
            document.body.classList.toggle(
                "ges723-labels-hidden",
                !checkbox.checked
            );
        }

        checkbox.addEventListener("change", updateLabels);

        // 06. Add below the existing OSM checkbox
        const osmControl = document.querySelector(
            ".ges723-basemap-control"
        );

        if (osmControl) {
            osmControl.appendChild(label);
        } else if (
            typeof L !== "undefined" &&
            typeof map !== "undefined"
        ) {
            const control = L.control({
                position: "bottomright"
            });

            control.onAdd = function () {
                const box = L.DomUtil.create(
                    "div",
                    "ges723-basemap-control"
                );

                box.appendChild(label);

                L.DomEvent.disableClickPropagation(box);
                L.DomEvent.disableScrollPropagation(box);

                return box;
            };

            control.addTo(map);
        }

        updateLabels();

        console.log(
            "GES723 Pump Labels Toggle: READY"
        );
    }

    // 07. Initialise after Leaflet and existing scripts
    if (document.readyState === "complete") {
        setupLabelToggle();
    } else {
        window.addEventListener(
            "load",
            setupLabelToggle,
            {once: true}
        );
    }
})();
