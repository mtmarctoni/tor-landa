import HistoryButton from "@/components/HistoryButton";
import QualityTracker from "@/sections/QualityTracker";

export default function Home() {
  return (
    <main className="flex-1 container mx-auto px-4 py-12">
      <QualityTracker />
      <HistoryButton />
    </main>
  );
}
