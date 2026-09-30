import { MAP_BASEMAP_PROVIDERS } from "@hasut/types";
import {
  ESRI_WORLD_IMAGERY_TILE_URL,
  advanceBasemapIndex,
  resolveMapTileChain,
} from "./map-basemaps";

describe("resolveMapTileChain", () => {
  it("uses MapTiler satellite first when a key is present, then Stadia and Esri", () => {
    const chain = resolveMapTileChain({
      primary: "maptiler",
      maptilerApiKey: "tiler-key",
      stadiaApiKey: "stadia-key",
    });
    expect(chain.provider).toBe("maptiler");
    expect(chain.tileUrl).toContain("api.maptiler.com/maps/satellite");
    expect(chain.tileUrl).toContain("tiler-key");
    expect(chain.fallbackTileUrls).toHaveLength(2);
    expect(chain.fallbackTileUrls[0]).toContain("alidade_satellite");
    expect(chain.fallbackTileUrls[0]).toContain("stadia-key");
    expect(chain.fallbackTileUrls[1]).toBe(ESRI_WORLD_IMAGERY_TILE_URL);
  });

  it("uses Esri satellite when no provider key is set", () => {
    const chain = resolveMapTileChain({ primary: "maptiler" });
    expect(chain.provider).toBe("maptiler");
    expect(chain.tileUrl).toBe(ESRI_WORLD_IMAGERY_TILE_URL);
    expect(chain.fallbackTileUrls).toEqual([]);
    expect(chain.attribution).toContain("Esri");
  });

  it("places a custom XYZ template first, then the three providers", () => {
    const chain = resolveMapTileChain({
      primary: "stadia",
      customTileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      maptilerApiKey: "tiler-key",
    });
    expect(chain.tileUrl).toBe("https://tiles.example/{z}/{x}/{y}.png");
    expect(chain.fallbackTileUrls[0]).toContain("maps/satellite");
    expect(chain.fallbackTileUrls[1]).toBe(ESRI_WORLD_IMAGERY_TILE_URL);
  });

  it("covers every catalog provider", () => {
    expect(MAP_BASEMAP_PROVIDERS).toEqual(["maptiler", "stadia", "carto"]);
  });
});

describe("advanceBasemapIndex", () => {
  it("walks a three-layer chain once per failure", () => {
    expect(advanceBasemapIndex(0, 3)).toBe(1);
    expect(advanceBasemapIndex(1, 3)).toBe(2);
    expect(advanceBasemapIndex(2, 3)).toBeNull();
  });
});
