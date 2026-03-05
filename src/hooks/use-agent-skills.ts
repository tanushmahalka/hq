import { useState, useEffect, useCallback, useMemo } from "react";
import { useGateway } from "@/hooks/use-gateway";

export type AgentSkill = {
  name: string;
  description: string;
  source: string;
  skillKey: string;
  filePath: string;
  baseDir: string;
  bundled?: boolean;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
};

type SkillsStatusResponse = {
  skills?: AgentSkill[];
};

type UseAgentSkillsReturn = {
  skills: AgentSkill[];
  selectedSkillKey: string | null;
  selectedSkill: AgentSkill | null;
  loadingSkills: boolean;
  selectSkill: (skillKey: string) => void;
};

export function useAgentSkills(agentId: string | null): UseAgentSkillsReturn {
  const { client, connected } = useGateway();
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loadedAgentId, setLoadedAgentId] = useState<string | null>(null);
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !connected || !agentId) return;

    let cancelled = false;

    client
      .request<SkillsStatusResponse>("skills.status", { agentId })
      .then((res) => {
        if (cancelled) return;
        const list = (res.skills ?? []).filter((skill) => skill.eligible);
        setSkills(list);
        setLoadedAgentId(agentId);
        setSelectedSkillKey((current) =>
          current && list.some((skill) => skill.skillKey === current)
            ? current
            : (list[0]?.skillKey ?? null),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSkills([]);
          setLoadedAgentId(agentId);
          setSelectedSkillKey(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, connected, agentId]);

  const selectSkill = useCallback((skillKey: string) => {
    setSelectedSkillKey(skillKey);
  }, []);

  const scopedSkills = useMemo(
    () => (agentId && loadedAgentId === agentId ? skills : []),
    [agentId, loadedAgentId, skills],
  );

  const scopedSelectedSkillKey = useMemo(
    () => (agentId && loadedAgentId === agentId ? selectedSkillKey : null),
    [agentId, loadedAgentId, selectedSkillKey],
  );

  const selectedSkill = useMemo(
    () => scopedSkills.find((skill) => skill.skillKey === scopedSelectedSkillKey) ?? null,
    [scopedSelectedSkillKey, scopedSkills],
  );

  const loadingSkills = useMemo(
    () => Boolean(agentId && connected && loadedAgentId !== agentId),
    [agentId, connected, loadedAgentId],
  );

  return {
    skills: scopedSkills,
    selectedSkillKey: scopedSelectedSkillKey,
    selectedSkill,
    loadingSkills,
    selectSkill,
  };
}
