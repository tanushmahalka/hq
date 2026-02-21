import { useState, useEffect } from "react";
import { Database, Table2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Db() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data: agents, isLoading: loadingAgents } = trpc.db.agents.useQuery();
  const { data: tables, isLoading: loadingTables } = trpc.db.tables.useQuery(
    { agentId: selectedAgent! },
    { enabled: !!selectedAgent },
  );
  const { data: tableData, isLoading: loadingData } = trpc.db.table.useQuery(
    { agentId: selectedAgent!, tableName: selectedTable! },
    { enabled: !!selectedAgent && !!selectedTable },
  );

  // Auto-select first agent
  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].id);
    }
  }, [agents, selectedAgent]);

  // Auto-select first table when tables change
  useEffect(() => {
    if (tables && tables.length > 0) {
      setSelectedTable(tables[0]);
    } else {
      setSelectedTable(null);
    }
  }, [tables]);

  return (
    <div className="flex h-full">
      {/* Agents panel */}
      <div className="w-[200px] shrink-0 border-r flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Agents
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {loadingAgents ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !agents || agents.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No databases configured</p>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors capitalize",
                  selectedAgent === agent.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Database className="size-4 shrink-0" />
                <span className="truncate">{agent.id}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Tables panel */}
      <div className="w-[220px] shrink-0 border-r flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tables
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {!selectedAgent ? (
            <p className="text-xs text-muted-foreground p-3">Select an agent</p>
          ) : loadingTables ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !tables || tables.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No tables</p>
          ) : (
            tables.map((table) => (
              <button
                key={table}
                onClick={() => setSelectedTable(table)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors",
                  selectedTable === table
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Table2 className="size-4 shrink-0" />
                <span className="truncate">{table}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Data panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b flex items-center gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedTable ?? "Data"}
          </h2>
          {tableData && (
            <span className="text-xs text-muted-foreground">
              {tableData.rows.length} row{tableData.rows.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          {!selectedTable ? (
            <p className="text-sm text-muted-foreground p-4">Select a table to view its data</p>
          ) : loadingData ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : !tableData ? (
            <p className="text-sm text-muted-foreground p-4">Failed to load table data</p>
          ) : tableData.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Table is empty</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {tableData.columns.map((col) => (
                    <th
                      key={col.name}
                      className="text-left px-3 py-2 font-medium text-foreground border-b whitespace-nowrap"
                    >
                      {col.name}
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                        {col.type}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/40">
                    {tableData.columns.map((col) => (
                      <td key={col.name} className="px-3 py-1.5 whitespace-nowrap max-w-[300px] truncate">
                        {row[col.name] === null ? (
                          <span className="text-muted-foreground italic">null</span>
                        ) : typeof row[col.name] === "object" ? (
                          JSON.stringify(row[col.name])
                        ) : (
                          String(row[col.name])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
