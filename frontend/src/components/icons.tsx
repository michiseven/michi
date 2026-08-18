import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function ArrowUpIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m18 15-6-6-6 6" /></svg>;
}

export function ArrowDownIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m6 9 6 6 6-6" /></svg>;
}

export function TrashIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>;
}

export function RefreshIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M18.5 9a7 7 0 0 0-12-2.5L4 9M5.5 15a7 7 0 0 0 12 2.5L20 15" /></svg>;
}

export function ArrowRightIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export function MapPinIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
