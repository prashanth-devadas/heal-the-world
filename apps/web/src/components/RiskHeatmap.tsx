import { useEffect, useRef } from "react";
import { Deck } from "@deck.gl/core";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { Campaign } from "../lib/api";

interface RiskHeatmapProps {
  campaigns: Campaign[];
  /** Cesium viewer canvas element — Deck.gl renders on top as an overlay */
  cesiumCanvas: HTMLCanvasElement | null;
}

export function RiskHeatmap({ campaigns, cesiumCanvas }: RiskHeatmapProps) {
  const deckRef = useRef<Deck | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!cesiumCanvas) return;

    // Create overlay canvas matching Cesium canvas
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.pointerEvents = "none";
    canvas.width = cesiumCanvas.width;
    canvas.height = cesiumCanvas.height;
    cesiumCanvas.parentElement?.appendChild(canvas);
    canvasRef.current = canvas;

    deckRef.current = new Deck({
      canvas,
      controller: false, // Cesium handles navigation
      initialViewState: {
        longitude: 0,
        latitude: 20,
        zoom: 1.5,
      },
      layers: [],
    });

    return () => {
      deckRef.current?.finalize();
      canvas.remove();
    };
  }, [cesiumCanvas]);

  // Update layers when campaigns change
  useEffect(() => {
    if (!deckRef.current) return;

    const heatmapData = campaigns.map((c) => ({
      coordinates: [(c.bbox[0] + c.bbox[2]) / 2, (c.bbox[1] + c.bbox[3]) / 2] as [number, number],
      weight: c.confidence * (c.severity === "critical" ? 4 : c.severity === "high" ? 2.5 : 1),
    }));

    const scatterData = campaigns
      .filter((c) => c.status === "triggered" || c.status === "voting")
      .map((c) => ({
        coordinates: [(c.bbox[0] + c.bbox[2]) / 2, (c.bbox[1] + c.bbox[3]) / 2] as [number, number],
        radius: 80_000, // 80km radius
      }));

    deckRef.current.setProps({
      layers: [
        new HeatmapLayer({
          id: "risk-heatmap",
          data: heatmapData,
          getPosition: (d: any) => d.coordinates,
          getWeight: (d: any) => d.weight,
          radiusPixels: 60,
          colorRange: [
            [0, 255, 100, 0],
            [255, 255, 0, 80],
            [255, 140, 0, 140],
            [255, 30, 0, 200],
          ],
          threshold: 0.05,
          opacity: 0.6,
        }),
        new ScatterplotLayer({
          id: "triggered-scatter",
          data: scatterData,
          getPosition: (d: any) => d.coordinates,
          getRadius: (d: any) => d.radius,
          getFillColor: [255, 100, 0, 40],
          getLineColor: [255, 100, 0, 180],
          stroked: true,
          lineWidthMinPixels: 2,
        }),
      ],
    });
  }, [campaigns]);

  // Keep overlay canvas in sync with Cesium canvas size
  useEffect(() => {
    if (!cesiumCanvas || !canvasRef.current) return;
    const obs = new ResizeObserver(() => {
      if (canvasRef.current) {
        canvasRef.current.width = cesiumCanvas.width;
        canvasRef.current.height = cesiumCanvas.height;
      }
    });
    obs.observe(cesiumCanvas);
    return () => obs.disconnect();
  }, [cesiumCanvas]);

  return null; // renders into overlay canvas, not DOM tree
}
