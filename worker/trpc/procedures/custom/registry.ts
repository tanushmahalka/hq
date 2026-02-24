import type { CustomRouterEntry } from "./types";
import { exampleRouter } from "./example";
import { missionRouter } from "./mission";
import { objectiveRouter } from "./objective";
import { campaignRouter } from "./campaign";

const customRouters: CustomRouterEntry[] = [
  { key: "example", router: exampleRouter },
  { key: "mission", router: missionRouter },
  { key: "objective", router: objectiveRouter },
  { key: "campaign", router: campaignRouter },
];

export default customRouters;
