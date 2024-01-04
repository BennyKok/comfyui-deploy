import { Check, CircleOff, SatelliteDish } from "lucide-react";
import React from "react";
import { ReadyState } from "react-use-websocket";

export function getConnectionStatus(readyState: ReadyState) {
  const connectionStatus = {
    [ReadyState.CONNECTING]: (
      <SatelliteDish size={14} className="text-orange-500" />
    ),
    [ReadyState.OPEN]: <Check size={14} className="text-green-500" />,
    [ReadyState.CLOSING]: <CircleOff size={14} className="text-orange-500" />,
    [ReadyState.CLOSED]: <CircleOff size={14} className="text-red-500" />,
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return connectionStatus;
}
