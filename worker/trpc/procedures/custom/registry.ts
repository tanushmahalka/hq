import type { CustomRouterEntry } from "./types";
import { exampleRouter } from "./example";

const customRouters: CustomRouterEntry[] = [
  { key: "example", router: exampleRouter },
];

export default customRouters;
