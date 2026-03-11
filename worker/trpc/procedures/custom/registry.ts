import type { CustomRouterEntry } from "./types.ts";
import { exampleRouter } from "./example.ts";
import { missionRouter } from "./mission.ts";
import { objectiveRouter } from "./objective.ts";
import { campaignRouter } from "./campaign.ts";

const customRouters: CustomRouterEntry[] = [
  { key: "example", router: exampleRouter },
  { key: "mission", router: missionRouter },
  { key: "objective", router: objectiveRouter },
  { key: "campaign", router: campaignRouter },
];

export default customRouters;
