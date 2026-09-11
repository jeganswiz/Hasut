import { MAP_BASEMAP_PROVIDERS } from "@hasut/types";
import { CARTO_POSITRON_TILE_URL, advanceBasemapIndex, resolveMapTileChain } from "./map-basemaps";

describe("resolveMapTileChain", () => {
  it("uses MapTiler first when a key is present, then Stadia and CARTO", () => {
    const chain = resolveMapTileChain({
      primary: "maptiler",
      maptilerApiKey: "tiler-key",
      stadiaApiKey: "stadia-key",
    });
    expect(chain.provider).toBe("maptiler");
    expect(chain.tileUrl).toContain("api.maptiler.com/maps/dataviz");
    expect(chain.tileUrl).toContain("tiler-key");
    expect(chain.fallbackTileUrls).toHaveLength(2);
    expect(chain.fallbackTileUrls[0]).toContain("stadiamaps.com");
    expect(chain.fallbackTileUrls[0]).toContain("stadia-key");
    expect(chain.fallbackTileUrls[1]).toBe(CARTO_POSITRON_TILE_URL);
  });

  it("skips MapTiler when the API key is empty", () => {
    const chain = resolveMapTileChain({ primary: "maptiler" });
    expect(chain.provider).toBe("maptiler");
    expect(chain.tileUrl).toContain("stadiamaps.com");
    expect(chain.fallbackTileUrls).toEqual([CARTO_POSITRON_TILE_URL]);
  });

  it("places a custom XYZ template first, then the three providers", () => {
    const chain = resolveMapTileChain({
      primary: "stadia",
      customTileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      maptilerApiKey: "tiler-key",
    });
    expect(chain.tileUrl).toBe("https://tiles.example/{z}/{x}/{y}.png");
    expect(chain.fallbackTileUrls[0]).toContain("stadiamaps.com");
    expect(chain.fallbackTileUrls[1]).toContain("maptiler.com");
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
