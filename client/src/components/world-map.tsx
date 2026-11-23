import { useEffect, useRef, memo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";

const ALL_PINS: [number, number][] = [
  [-98, 39], [-47, -15], [2, 48], [28, -2],
  [78, 22], [116, 35], [139, 36], [135, -25],
  [24, 56], [-3, 35], [100, 15], [-75, 4],
];

const W = 400;
const H = 220;
const SPEED = 0.12;
const PIN_INTERVAL = 900;
const NS = "http://www.w3.org/2000/svg";

function shuffle(): number[] {
  return [...Array(ALL_PINS.length).keys()].sort(() => Math.random() - 0.5);
}

function getPrimary(): string {
  try {
    const s = getComputedStyle(document.documentElement);
    const v = s.getPropertyValue("--primary").trim();
    return v ? `hsl(${v})` : "#ef4444";
  } catch {
    return "#ef4444";
  }
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

const WorldMapInner = memo(function WorldMapInner() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let mounted = true;
    let raf: number;

    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (!mounted || !svgRef.current) return;
        const land = feature(topo, topo.objects.land);
        startAnimation(land);
      });

    function startAnimation(land: any) {
      const svg = svgRef.current!;

      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const landEl = document.createElementNS(NS, "path");
      let dark = isDarkMode();
      landEl.setAttribute("fill", dark ? "#ffffff" : "#000000");
      landEl.setAttribute("fill-opacity", dark ? "0.18" : "0.12");
      landEl.setAttribute("stroke", dark ? "#ffffff" : "#000000");
      landEl.setAttribute("stroke-opacity", dark ? "0.08" : "0.06");
      landEl.setAttribute("stroke-width", "0.4");
      svg.appendChild(landEl);

      const pinsGroup = document.createElementNS(NS, "g");
      svg.appendChild(pinsGroup);

      let rot = 0;
      let lastPinTime = performance.now();
      let dropIndex = 0;
      let order = shuffle();
      let activeIndices: number[] = [];
      let pinElements: Map<number, SVGGElement> = new Map();

      let color = getPrimary();
      let colorRefreshTime = performance.now();

      function tick() {
        if (!mounted) return;

        rot += SPEED;
        const now = performance.now();

        if (now - colorRefreshTime > 2000) {
          color = getPrimary();
          colorRefreshTime = now;
          const nowDark = isDarkMode();
          if (nowDark !== dark) {
            landEl.setAttribute("fill", nowDark ? "#ffffff" : "#000000");
            landEl.setAttribute("fill-opacity", nowDark ? "0.18" : "0.12");
            landEl.setAttribute("stroke", nowDark ? "#ffffff" : "#000000");
            landEl.setAttribute("stroke-opacity", nowDark ? "0.08" : "0.06");
            dark = nowDark;
          }
        }

        if (now - lastPinTime > PIN_INTERVAL) {
          lastPinTime = now;

          if (dropIndex < order.length) {
            const pinIdx = order[dropIndex];
            activeIndices.push(pinIdx);
            dropIndex++;

            const g = document.createElementNS(NS, "g");

            const pulse = document.createElementNS(NS, "circle");
            pulse.setAttribute("r", "10");
            pulse.setAttribute("fill", color);
            pulse.setAttribute("fill-opacity", "0.12");
            g.appendChild(pulse);

            const glow = document.createElementNS(NS, "circle");
            glow.setAttribute("r", "7");
            glow.setAttribute("fill", color);
            glow.setAttribute("fill-opacity", "0.25");
            g.appendChild(glow);

            const dot = document.createElementNS(NS, "circle");
            dot.setAttribute("r", "4");
            dot.setAttribute("fill", color);
            g.appendChild(dot);

            const ring = document.createElementNS(NS, "circle");
            ring.setAttribute("r", "8");
            ring.setAttribute("fill", "none");
            ring.setAttribute("stroke", color);
            ring.setAttribute("stroke-width", "0.8");
            ring.setAttribute("opacity", "0.5");
            g.appendChild(ring);

            pinsGroup.appendChild(g);
            pinElements.set(pinIdx, g);
          } else {
            activeIndices = [];
            dropIndex = 0;
            order = shuffle();
            while (pinsGroup.firstChild) pinsGroup.removeChild(pinsGroup.firstChild);
            pinElements.clear();
          }
        }

        const projection = geoNaturalEarth1()
          .rotate([rot, 0, 0])
          .scale(100)
          .translate([W / 2, H / 2]);

        const pathGen = geoPath(projection);
        const d = pathGen(land) || "";
        landEl.setAttribute("d", d);

        for (const pinIdx of activeIndices) {
          const g = pinElements.get(pinIdx);
          if (!g) continue;

          const coords = ALL_PINS[pinIdx];
          const pos = projection(coords);

          if (pos) {
            const inBounds = pos[0] > 10 && pos[0] < W - 10;
            g.style.display = inBounds ? "" : "none";
            if (inBounds) {
              const children = g.children;
              for (let c = 0; c < children.length; c++) {
                (children[c] as SVGElement).setAttribute("cx", String(pos[0]));
                (children[c] as SVGElement).setAttribute("cy", String(pos[1]));
              }
            }
          } else {
            g.style.display = "none";
          }
        }

        raf = requestAnimationFrame(tick);
      }

      raf = requestAnimationFrame(tick);
    }

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative w-full">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" />
    </div>
  );
});

export function WorldMap() {
  return <WorldMapInner />;
}
