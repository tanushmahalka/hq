import { useGateway } from "@/hooks/use-gateway";

export default function Example() {
  const { connected, agents } = useGateway();

  return (
    <div className="flex flex-col h-full p-5">
      <h1 className="text-2xl font-normal mb-4">Example Custom Page</h1>
      <p className="text-sm text-muted-foreground">
        Gateway {connected ? "connected" : "disconnected"} &middot;{" "}
        {agents.length} agent{agents.length !== 1 && "s"} online
      </p>
    </div>
  );
}
