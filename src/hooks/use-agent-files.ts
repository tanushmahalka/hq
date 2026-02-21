import { useState, useEffect, useCallback } from "react";
import { useGateway } from "@/hooks/use-gateway";

export type AgentFile = {
  name: string;
  [key: string]: unknown;
};

type UseAgentFilesReturn = {
  files: AgentFile[];
  selectedFile: string | null;
  fileContent: string | null;
  loadingFiles: boolean;
  loadingContent: boolean;
  selectFile: (path: string) => void;
};

export function useAgentFiles(agentId: string | null): UseAgentFilesReturn {
  const { client, connected } = useGateway();
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  // Fetch file list when agent changes
  useEffect(() => {
    if (!client || !connected || !agentId) {
      setFiles([]);
      setSelectedFile(null);
      setFileContent(null);
      return;
    }

    let cancelled = false;
    setLoadingFiles(true);
    setSelectedFile(null);
    setFileContent(null);

    client
      .request<{ files: AgentFile[] } | AgentFile[]>("agents.files.list", {
        agentId,
      })
      .then((res) => {
        if (cancelled) return;
        // Handle both { files: [...] } and direct array responses
        const list = Array.isArray(res) ? res : res.files ?? [];
        setFiles(list);
        // Auto-select first file
        if (list.length > 0) {
          setSelectedFile(list[0].name);
        }
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, connected, agentId]);

  // Fetch file content when selected file changes
  useEffect(() => {
    if (!client || !connected || !agentId || !selectedFile) {
      setFileContent(null);
      return;
    }

    let cancelled = false;
    setLoadingContent(true);

    client
      .request<{ file: { content?: string } }>("agents.files.get", {
        agentId,
        name: selectedFile,
      })
      .then((res) => {
        if (cancelled) return;
        setFileContent(res.file?.content ?? "");
      })
      .catch(() => {
        if (!cancelled) setFileContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingContent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, connected, agentId, selectedFile]);

  const selectFile = useCallback((path: string) => {
    setSelectedFile(path);
  }, []);

  return { files, selectedFile, fileContent, loadingFiles, loadingContent, selectFile };
}
