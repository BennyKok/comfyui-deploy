"use client";

import type { LogsType } from "@/components/LogsViewer";
import { LogsViewer } from "@/components/LogsViewer";
import { getConnectionStatus } from "@/components/getConnectionStatus";
import { useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";

export function MachineBuildLog({
  machine_id,
  endpoint,
  instance_id,
}: {
  machine_id: string;
  endpoint: string;
  instance_id: string;
}) {
  const [logs, setLogs] = useState<LogsType>([]);
  const [finished, setFinished] = useState(false);

  const wsEndpoint = endpoint.replace(/^http/, "ws");
  const query = { fly_instance_id: instance_id };
  const { lastMessage, readyState } = useWebSocket(
    `${wsEndpoint}/ws/${machine_id}`,
    {
      shouldReconnect: () => !finished,
      reconnectAttempts: 20,
      reconnectInterval: 1000,
      queryParams: query,
    }
  );

  const connectionStatus = getConnectionStatus(readyState);

  useEffect(() => {
    if (!lastMessage?.data) return;

    const message = JSON.parse(lastMessage.data);

    console.log(message);

    if (message?.event === "LOGS") {
      setLogs((logs) => [...(logs ?? []), message.data]);
    } else if (message?.event === "FINISHED") {
      setFinished(true);
    }
  }, [lastMessage]);

  return (
    <div>
      {connectionStatus}
      <LogsViewer logs={logs} />
    </div>
  );
}
