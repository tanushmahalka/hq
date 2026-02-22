import type { CustomPageEntry } from "./types";

const customPages: CustomPageEntry[] = [
  {
    id: "example",
    label: "Example",
    icon: "sparkles",
    component: () => import("./example"),
  },
];

export default customPages;
