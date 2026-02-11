import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../worker/trpc/router";

export const trpc = createTRPCReact<AppRouter>();
