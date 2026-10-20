"use client";

import { MotionConfig } from "framer-motion";

export default function MotionPreferences({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
