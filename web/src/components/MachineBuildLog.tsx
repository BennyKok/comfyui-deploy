"use client";

import type { LogsType } from "@/components/LogsViewer";
import { LogsViewer } from "@/components/LogsViewer";
import { getConnectionStatus } from "@/components/getConnectionStatus";
import { useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";

export function MachineBuildLog({
  machine_id,
  endpoint,
}: {
  machine_id: string;
  endpoint: string;
}) {
  const [logs, setLogs] = useState<LogsType>([]);

  const wsEndpoint = endpoint.replace(/^http/, "ws");
  const { lastMessage, readyState } = useWebSocket(
    `${wsEndpoint}/ws/${machine_id}`,
    {
      shouldReconnect: () => true,
      reconnectAttempts: 20,
      reconnectInterval: 1000,
    }
  );

  const connectionStatus = getConnectionStatus(readyState);

  useEffect(() => {
    if (!lastMessage?.data) return;

    const message = JSON.parse(lastMessage.data);

    console.log(message);

    if (message?.event === "LOGS") {
      setLogs((logs) => [...(logs ?? []), message.data]);
    }
  }, [lastMessage]);

  return (
    <div>
      {connectionStatus}
      <LogsViewer logs={logs} />
    </div>
  );
}
