"use client";

import { createContext, useContext } from "react";
import JournalDialog, {
  type JournalDialogProps,
} from "@/components/JournalDialog";

/** Suspend native ownership, not the mounted private draft, during verification. */
export const ShoeboxDialogSuspended = createContext(false);

export default function ShoeboxDialog(props: JournalDialogProps) {
  const suspended = useContext(ShoeboxDialogSuspended);
  return <JournalDialog {...props} isOpen={props.isOpen && !suspended} />;
}
