import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useGateway } from "@/hooks/use-gateway";
import { MissionListRow } from "@/components/missions/mission-list-row";
import { MissionDetailPanel } from "@/components/missions/mission-detail-panel";
import { MissionCreateDialog } from "@/components/missions/mission-create-dialog";

export default function Missions() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    null
  );
  const { agents } = useGateway();

  const { data: missions, isLoading } = trpc.custom.mission.list.useQuery();

  // Fetch all tasks to compute campaign task counts
  const { data: allTasks } = trpc.task.list.useQuery();

  // Build tasksByCampaign map
  type CampaignTaskEntry = {
    done: number;
    total: number;
    tasks: Array<{ id: string; title: string; status: string }>;
  };
  const tasksByCampaign: Record<string, CampaignTaskEntry> = {};
  if (allTasks) {
    for (const task of allTasks) {
      const cid = (task as { campaignId?: string | null }).campaignId;
      if (!cid) continue;
      if (!tasksByCampaign[cid])
        tasksByCampaign[cid] = { done: 0, total: 0, tasks: [] };
      tasksByCampaign[cid].total++;
      if (task.status === "done") tasksByCampaign[cid].done++;
      tasksByCampaign[cid].tasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
      });
    }
  }

  // Auto-select first mission
  useEffect(() => {
    if (!selectedMissionId && missions?.length) {
      setSelectedMissionId(missions[0].id);
    }
  }, [missions, selectedMissionId]);

  // If selected mission was deleted, clear selection
  useEffect(() => {
    if (
      selectedMissionId &&
      missions &&
      !missions.find((m) => m.id === selectedMissionId)
    ) {
      setSelectedMissionId(missions.length > 0 ? missions[0].id : null);
    }
  }, [missions, selectedMissionId]);

  const selectedMission = missions?.find((m) => m.id === selectedMissionId);
  const selectedAgent = selectedMission
    ? agents.find((a) => a.id === selectedMission.agentId)
    : undefined;

  return (
    <div className="flex flex-col h-full p-12">
      {/* Header */}
      <div className="flex items-center justify-between pt-4 pb-8">
        <h1 className="font-display text-5xl font-normal text-foreground">
          Missions
        </h1>
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
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!missions || missions.length === 0) && (
        <p className="text-sm text-muted-foreground/40 text-center py-20">
          No missions yet. Create one to get started.
        </p>
      )}

      {/* Split layout */}
      {!isLoading && missions && missions.length > 0 && (
        <div className="flex flex-1 min-h-0 rounded-xl border border-border/40 overflow-hidden">
          {/* Left: List panel */}
          <div className="w-[380px] shrink-0 border-r border-border/40 overflow-y-auto">
            {missions.map((mission) => {
              const agent = agents.find((a) => a.id === mission.agentId);
              return (
                <MissionListRow
                  key={mission.id}
                  mission={mission}
                  agent={agent}
                  selected={mission.id === selectedMissionId}
                  onClick={() => setSelectedMissionId(mission.id)}
                />
              );
            })}
          </div>

          {/* Right: Detail panel */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {selectedMission ? (
              <MissionDetailPanel
                key={selectedMission.id}
                mission={selectedMission}
                agent={selectedAgent}
                tasksByCampaign={tasksByCampaign}
                onDeleted={() => setSelectedMissionId(null)}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground/40">
                  Select a mission to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <MissionCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
