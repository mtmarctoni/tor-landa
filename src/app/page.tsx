import HistoryButton from "@/components/HistoryButton";
import QualityTracker from "@/sections/QualityTracker";

export default function Home() {
  return (
    <main className="container mx-auto flex-1 px-4 py-8 sm:py-12">
      <QualityTracker />
      <HistoryButton />
    </main>
  );
}
