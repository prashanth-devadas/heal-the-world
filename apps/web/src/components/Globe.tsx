import { useEffect, useRef } from "react";
import type { Campaign } from "../lib/api";

// CesiumJS is loaded as a UMD global via script tag to avoid bundler issues
declare const Cesium: typeof import("cesium");

// Color by severity
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff1a1a",
  high:     "#ff8800",
  medium:   "#ffdd00",
  low:      "#00cc44",
};

interface GlobeProps {
  campaigns: Campaign[];
  onSelect: (campaign: Campaign) => void;
}

export function Globe({ campaigns, onSelect }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // Cesium Ion token (optional — we use OSM tiles which are free)
    // @ts-expect-error dynamic global
    window.CESIUM_BASE_URL = "/cesium";

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      creditContainer: document.createElement("div"), // hide credit
    });

    // Use OpenStreetMap imagery (open source)
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        credit: "© OpenStreetMap contributors",
      })
    );

    // Style the atmosphere
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.enableLighting = true;

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Update campaign markers whenever campaigns change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();

    for (const campaign of campaigns) {
      const [minLng, minLat, maxLng, maxLat] = campaign.bbox;
      const lat = (minLat + maxLat) / 2;
      const lng = (minLng + maxLng) / 2;
      const color = SEVERITY_COLORS[campaign.severity] ?? "#888888";

      const entity = viewer.entities.add({
        id: campaign.id,
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        billboard: {
          image: makeMarkerSvg(color, campaign.severity),
          width: 40,
          height: 40,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: campaign.region,
          font: "12px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -44),
          show: false, // show on hover/select
        },
      });

      // Store campaign data on entity for click handler
      (entity as any)._campaign = campaign;
    }

    // Click handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id) {
        const campaign = (picked.id as any)._campaign as Campaign | undefined;
        if (campaign) {
          // Show label
          picked.id.label.show = true;
          onSelect(campaign);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [campaigns, onSelect]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}

function makeMarkerSvg(color: string, severity: string): string {
  const size = severity === "critical" ? 14 : severity === "high" ? 11 : 9;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="${size}" fill="${color}" fill-opacity="0.85" stroke="white" stroke-width="2"/>
      <circle cx="20" cy="20" r="${size + 4}" fill="${color}" fill-opacity="0.25"/>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
