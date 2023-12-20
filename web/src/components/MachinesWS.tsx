"use client";

import { Badge } from "@/components/ui/badge";
import type { getMachines } from "@/server/curdMachine";
import { Check, CircleOff, SatelliteDish } from "lucide-react";
import React, { useEffect } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { create } from "zustand";

type State = {
  data: {
    id: string;
    timestamp: number;
    json: {
      event: string;
      data: any;
    };
  }[];
  addData: (
    id: string,
    json: {
      event: string;
      data: any;
    }
  ) => void;
};

export const useStore = create<State>((set) => ({
  data: [],
  addData: (id, json) =>
    set((state) => ({
      ...state,
      data: [...state.data, { id, json, timestamp: Date.now() }],
    })),
}));

export function MachinesWSMain(props: {
  machines: Awaited<ReturnType<typeof getMachines>>;
}) {
  return (
    <div className="flex flex-col gap-2 mt-4">
      Machine Status
      <div className="flex flex-wrap gap-2">
        {props.machines.map((x) => (
          <MachineWS key={x.id} machine={x} />
        ))}
      </div>
    </div>
  );
}

function MachineWS({
  machine,
}: {
  machine: Awaited<ReturnType<typeof getMachines>>[0];
}) {
  const { addData } = useStore();
  const wsEndpoint = machine.endpoint.replace(/^http/, "ws");
  const { lastMessage, readyState } = useWebSocket(
    `${wsEndpoint}/comfyui-deploy/ws`,
    {
      shouldReconnect: () => true,
      reconnectAttempts: 20,
      reconnectInterval: 1000,
    }
  );

  const connectionStatus = {
    [ReadyState.CONNECTING]: (
      <SatelliteDish size={14} className="text-orange-500" />
    ),
    [ReadyState.OPEN]: <Check size={14} className="text-green-500" />,
    [ReadyState.CLOSING]: <CircleOff size={14} className="text-orange-500" />,
    [ReadyState.CLOSED]: <CircleOff size={14} className="text-red-500" />,
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  useEffect(() => {
    if (!lastMessage?.data) return;

    const message = JSON.parse(lastMessage.data);
    console.log(message.event, message);

    if (message.data?.prompt_id) {
      addData(message.data.prompt_id, message);
    }
  }, [lastMessage]);

  return (
    <Badge className="text-sm flex gap-2 font-normal" variant="outline">
      {machine.name} {connectionStatus}
    </Badge>
  );
}
