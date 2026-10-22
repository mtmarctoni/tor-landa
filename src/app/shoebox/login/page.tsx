import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ShoeboxLogin from "@/components/shoebox/ShoeboxLogin";
import ShoeboxSetupNotice from "@/components/shoebox/ShoeboxSetupNotice";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import { requireShoeboxSession } from "@/features/shoebox/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nuestra caja imposible",
  robots: "noindex, nofollow, noarchive",
};

async function hasSession(): Promise<boolean | "setup"> {
  try {
    await requireShoeboxSession();
    return true;
  } catch (error) {
    if (error instanceof ShoeboxError) {
      if (error.code === "SETUP_REQUIRED") return "setup";
      if (error.code === "UNAUTHORIZED") return false;
    }
    throw error;
  }
}

export default async function ShoeboxLoginPage() {
  const session = await hasSession();
  if (session === "setup") return <ShoeboxSetupNotice />;
  if (session) {
    redirect("/shoebox");
  }
  return <ShoeboxLogin />;
}
