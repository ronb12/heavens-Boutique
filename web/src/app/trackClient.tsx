"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export function HomeClientTrack() {
  useEffect(() => {
    track("page_view", { page: "home" });
  }, []);
  return null;
}

