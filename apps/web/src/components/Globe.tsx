import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { Campaign } from "../lib/api";

const BUBBLE_SIZES: Record<string, number> = {
  critical: 28, high: 20, medium: 14, low: 9,
};

// Conflicts: red tones; Natural disasters: amber/orange tones
const CONFLICT_COLORS: Record<string, string> = {
  critical: "#ff1a1a", high: "#ff5555", medium: "#ff8888", low: "#ffaaaa",
};
const NATURAL_COLORS: Record<string, string> = {
  critical: "#ff6600", high: "#ff9900", medium: "#ffcc00", low: "#ffee66",
};

const CONFLICT_TYPES = new Set(["conflict"]);

function getBubbleColor(campaign: Campaign): string {
  const palette = CONFLICT_TYPES.has(campaign.event_type) ? CONFLICT_COLORS : NATURAL_COLORS;
  return palette[campaign.severity] ?? "#888888";
}

function makeMarkerSvg(campaign: Campaign): string {
  const size = BUBBLE_SIZES[campaign.severity] ?? 9;
  const color = getBubbleColor(campaign);
  const predicted = campaign.predicted === true;
  const svgSize = 60;
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  const fill = predicted ? "none" : color;
  const stroke = color;
  const strokeWidth = predicted ? 2.5 : 1.5;
  const strokeDasharray = predicted ? "4 3" : "none";
  const glowOpacity = predicted ? 0.15 : 0.25;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">
    <circle cx="${cx}" cy="${cy}" r="${size + 6}" fill="${color}" fill-opacity="${glowOpacity}"/>
    <circle cx="${cx}" cy="${cy}" r="${size}" fill="${fill}" fill-opacity="${predicted ? 0 : 0.85}"
      stroke="${stroke}" stroke-width="${strokeWidth}"
      stroke-dasharray="${strokeDasharray}"/>
  </svg>`.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

interface GlobeProps {
  campaigns: Campaign[];
  onSelect: (campaign: Campaign) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export function Globe({ campaigns, onSelect, onCanvasReady }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

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
      creditContainer: document.createElement("div"),
    });

    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        credit: "© OpenStreetMap contributors",
      })
    );

    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.enableLighting = true;

    viewerRef.current = viewer;
    onCanvasReady?.(viewer.scene.canvas);

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [onCanvasReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();

    for (const campaign of campaigns) {
      const [minLng, minLat, maxLng, maxLat] = campaign.bbox;
      const lat = (minLat + maxLat) / 2;
      const lng = (minLng + maxLng) / 2;
      const markerSize = (BUBBLE_SIZES[campaign.severity] ?? 9) * 2 + 12;

      const entity = viewer.entities.add({
        id: campaign.id,
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        billboard: {
          image: makeMarkerSvg(campaign),
          width: markerSize,
          height: markerSize,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
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
          pixelOffset: new Cesium.Cartesian2(0, -(markerSize / 2 + 4)),
          show: false,
        },
      });

      (entity as any)._campaign = campaign;
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id) {
        const campaign = (picked.id as any)._campaign as Campaign | undefined;
        if (campaign) {
          picked.id.label.show = true;
          onSelect(campaign);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => { handler.destroy(); };
  }, [campaigns, onSelect]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}
