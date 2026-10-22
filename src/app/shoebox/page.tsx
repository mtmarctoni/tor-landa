import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ShoeboxArchive from "@/components/shoebox/ShoeboxArchive";
import ShoeboxSetupNotice from "@/components/shoebox/ShoeboxSetupNotice";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import { requireShoeboxSession } from "@/features/shoebox/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nuestra caja imposible",
  robots: "noindex, nofollow, noarchive",
};

async function sessionExpiry(): Promise<number | null | "setup"> {
  try {
    return (await requireShoeboxSession()).expiresAt;
  } catch (error) {
    if (error instanceof ShoeboxError && error.code === "SETUP_REQUIRED") {
      return "setup";
    }
    if (error instanceof ShoeboxError && error.code === "UNAUTHORIZED") {
      return null;
    }
    throw error;
  }
}

/** Verified on the server before anything private renders; no SSR list. */
export default async function ShoeboxPage() {
  const expiresAt = await sessionExpiry();
  if (expiresAt === "setup") return <ShoeboxSetupNotice />;
  if (expiresAt === null) {
    redirect("/shoebox/login");
  }
  return <ShoeboxArchive expiresAt={expiresAt} />;
}
