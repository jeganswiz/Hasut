import { fetchMapRoute, mapRouteProviderOrder, parseMapRouteResponse } from "./map-routing";

const line = {
  code: "Ok",
  routes: [
    {
      distance: 1200,
      duration: 180,
      geometry: {
        type: "LineString",
        coordinates: [
          [77.5, 13.0],
          [77.6, 13.1],
        ],
      },
    },
  ],
};

describe("map routing", () => {
  it("keeps a public router when no map key is configured", () => {
    expect(mapRouteProviderOrder({})).toEqual(["osrm"]);
    expect(mapRouteProviderOrder({ maptilerApiKey: "mt", stadiaApiKey: "st" })).toEqual([
      "maptiler",
      "stadia",
      "osrm",
    ]);
  });

  it("reads an OSRM line and a GeoJSON line", () => {
    expect(parseMapRouteResponse("osrm", line)?.distanceMeters).toBe(1200);
    expect(
      parseMapRouteResponse("maptiler", {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates: line.routes[0]?.geometry.coordinates },
            properties: { distance: 400, duration: 90 },
          },
        ],
      })?.provider,
    ).toBe("maptiler");
    expect(parseMapRouteResponse("osrm", { code: "NoRoute" })).toBeNull();
  });

  it("uses the next router when the first one fails", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      if (url.includes("maptiler")) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => line };
    }) as typeof fetch;
    const leg = await fetchMapRoute({
      origin: { latitude: 13, longitude: 77.5 },
      destination: { latitude: 13.1, longitude: 77.6 },
      maptilerApiKey: "mt",
      fetchImpl,
    });
    expect(leg?.provider).toBe("osrm");
    expect(urls.some((url) => url.includes("maptiler"))).toBe(true);
    expect(urls.some((url) => url.includes("project-osrm"))).toBe(true);
  });
});
