import type { SVGProps } from "react";

export type NavIconName =
  "map" | "connections" | "inbox" | "alerts" | "me" | "story" | "support" | "sign-in";

export function NavIcon({ name }: { name: NavIconName }) {
  const props: SVGProps<SVGSVGElement> = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (name === "map") {
    return (
      <svg {...props}>
        <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
        <circle cx="12" cy="10" r="1.7" />
      </svg>
    );
  }
  if (name === "connections") {
    return (
      <svg {...props}>
        <circle cx="9" cy="9" r="2.6" />
        <circle cx="16.2" cy="10" r="2.1" />
        <path d="M4.2 19c.6-2.8 2.4-4.2 4.8-4.2s4.2 1.4 4.8 4.2" />
        <path d="M14 15.2c1-.4 2.1-.5 3.2-.2 1.5.4 2.5 1.5 2.8 3" />
      </svg>
    );
  }
  if (name === "inbox") {
    return (
      <svg {...props}>
        <path d="M4 6.5h16v11.2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.7V6.5z" />
        <path d="M4 8l8 5.2L20 8" />
      </svg>
    );
  }
  if (name === "alerts") {
    return (
      <svg {...props}>
        <path d="M6 9.2a6 6 0 0 1 12 0c0 5.2 1.6 6.3 1.6 6.3H4.4S6 14.4 6 9.2z" />
        <path d="M10 18.2a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  if (name === "me") {
    return (
      <svg {...props}>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.2 19c1.1-3 3.2-4.5 6.8-4.5s5.7 1.5 6.8 4.5" />
      </svg>
    );
  }
  if (name === "story") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <path d="M10.2 8.8v6.4l5.2-3.2-5.2-3.2z" />
      </svg>
    );
  }
  if (name === "support") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M12 4.2v2.2M12 17.6v2.2M4.2 12h2.2M17.6 12h2.2" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M14 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H14" />
      <path d="M10 12h9" />
      <path d="M16 8.5 19.5 12 16 15.5" />
    </svg>
  );
}
