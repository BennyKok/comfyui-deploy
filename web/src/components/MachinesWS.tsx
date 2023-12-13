"use client";

import type { getMachines } from "@/server/curdMachine";
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
    <div className="flex flex-col gap-2 mt-6">
      Machine Status
      {props.machines.map((x) => (
        <MachineWS key={x.id} machine={x} />
      ))}
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
    `${wsEndpoint}/comfy-deploy/ws`,
    {
      reconnectAttempts: 10,
      reconnectInterval: 1000,
    }
  );

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
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
    <div className="text-sm">
      {machine.name} - {connectionStatus}
    </div>
  );
}
