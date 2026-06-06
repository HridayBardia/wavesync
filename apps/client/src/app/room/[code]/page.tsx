"use client";

import * as React from "react";
import { RoomShell } from "@/components/room/RoomShell";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = React.use(params);
  return <RoomShell roomCode={resolvedParams.code} />;
}

