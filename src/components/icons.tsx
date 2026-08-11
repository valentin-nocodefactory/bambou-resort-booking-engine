import type { SVGProps } from "react";

// Petites icônes inline (stroke = currentColor) — zéro dépendance.
const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const IconBed = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 7v11M3 12h18M21 18V11a3 3 0 0 0-3-3H8v4" />
    <circle cx="6" cy="11" r="1.4" />
  </svg>
);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
    <circle cx="9" cy="7" r="3.2" />
    <path d="M22 19v-1a4 4 0 0 0-3-3.87M16 3.3A4 4 0 0 1 16 11" />
  </svg>
);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m5 13 4 4L19 7" />
  </svg>
);
// Cloche de service (dôme qui couvre l'assiette) — pour le dîner.
export const IconCloche = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 18h18" />
    <path d="M5 18a7 7 0 0 1 14 0" />
    <path d="M12 11V8.5" />
    <circle cx="12" cy="7.3" r="1.1" />
  </svg>
);
// Croissant (croissant = « crescent ») — crescent galbé + 2 nervures obliques. Style
// trait, cohérent avec la cloche du dîner.
export const IconCroissant = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 15C4 9.5 7.5 7 12 7s8 2.5 8 8c-3-2.2-5-3-8-3s-5 .8-8 3Z" />
    <path d="m8 12.4 1.1-2.1M16 12.4l-1.1-2.1" />
  </svg>
);
export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconSparkles = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l1.8 4.8L18.5 9l-4.7 1.7L12 15l-1.8-4.3L5.5 9l4.7-1.2L12 3Z" />
    <path d="M19 14l.7 1.9L21.5 17l-1.8.6L19 19.5l-.7-1.9L16.5 17l1.8-.6L19 14Z" />
  </svg>
);
export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l8 3v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
export const IconMapPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);
export const IconLeaf = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 19c0-8 5-13 14-13 0 9-5 14-13 14M5 19c2-4 5-7 9-9" />
  </svg>
);
export const IconPalm = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21c-.4-5 .1-8.5 1.6-11.3" />
    <path d="M13.6 9.7C11 7.4 7.7 7 4.8 8.8" />
    <path d="M13.6 9.7c-.7-3.1.5-6.2 3.3-8" />
    <path d="M13.6 9.7c2.9-1.1 6.2 0 8.3 2.7" />
    <path d="M13.6 9.7c-2.7.5-5 2.4-6.4 5.3" />
  </svg>
);
export const IconWave = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 14c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />
  </svg>
);
export const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 3.2l2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7L7.4 18.7l1-5.6-4-4 5.6-.8L12 3.2Z" />
  </svg>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconFlame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3c1 3-1 4-1 6a2.5 2.5 0 0 0 5 .2C18 12 19 14 19 16a7 7 0 1 1-14 0c0-3 2.5-5 3.5-7 .8-1.6.5-3.8 0-4 2 .5 3 1.5 3.5 3Z" />
  </svg>
);
export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-7 7-9-9Z" />
    <circle cx="7.5" cy="7.5" r="1.4" />
  </svg>
);
export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 20s-7-4.3-9.3-8.6C1 8 2.6 5 5.7 5c1.9 0 3.1 1.1 3.8 2.2L12 9l2.5-1.8C15.2 6.1 16.4 5 18.3 5c3.1 0 4.7 3 3 6.4C19 15.7 12 20 12 20Z" />
  </svg>
);
export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
);
export const IconGift = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="8.5" width="17" height="12" rx="1.5" />
    <path d="M3.5 12.5h17M12 8.5v12M12 8.5C9 8.5 7 7 8 4.5c1-2 4 .5 4 4Zm0 0c3 0 5-1.5 4-4-1-2-4 .5-4 4Z" />
  </svg>
);
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
  </svg>
);
export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 2 5a2 2 0 0 1 2-2" />
  </svg>
);
export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="M3 6.5l9 6 9-6" />
  </svg>
);
export const IconShare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="18" cy="5" r="2.6" />
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="19" r="2.6" />
    <path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" />
  </svg>
);
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
