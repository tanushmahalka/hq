import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useGateway } from "@/hooks/use-gateway";
import { MissionCard } from "@/components/missions/mission-card";
import { MissionCreateDialog } from "@/components/missions/mission-create-dialog";

export default function Missions() {
  const [createOpen, setCreateOpen] = useState(false);
  const { agents } = useGateway();

  const { data: missions, isLoading } = trpc.custom.mission.list.useQuery();

  // Fetch all tasks to compute campaign task counts
  const { data: allTasks } = trpc.task.list.useQuery();

  // Build tasksByCampaign map
  type CampaignTaskEntry = { done: number; total: number; tasks: Array<{ id: string; title: string; status: string }> };
  const tasksByCampaign: Record<string, CampaignTaskEntry> = {};
  if (allTasks) {
    for (const task of allTasks) {
      const cid = (task as { campaignId?: string | null }).campaignId;
      if (!cid) continue;
      if (!tasksByCampaign[cid]) tasksByCampaign[cid] = { done: 0, total: 0, tasks: [] };
      tasksByCampaign[cid].total++;
      if (task.status === "done") tasksByCampaign[cid].done++;
      tasksByCampaign[cid].tasks.push({ id: task.id, title: task.title, status: task.status });
    }
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-normal">Missions</h1>
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          Mission
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!missions || missions.length === 0) && (
        <p className="text-xs text-muted-foreground/50 text-center py-16">
          No missions yet. Create one to get started.
        </p>
      )}

      {/* Mission cards */}
      <div className="space-y-2">
        {missions?.map((mission) => {
          const agent = agents.find((a) => a.id === mission.agentId);
          return (
            <MissionCard
              key={mission.id}
              mission={mission}
              agent={agent}
              tasksByCampaign={tasksByCampaign}
            />
          );
        })}
      </div>

      <MissionCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
