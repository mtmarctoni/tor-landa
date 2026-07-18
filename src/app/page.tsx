import FloatingQuote from "@/components/FloatingQuote";
import HistoryButton from "@/components/HistoryButton";
import QualityTracker from "@/sections/QualityTracker";

export default function Home() {
  return (
    <main className="home-main mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 pb-24 pt-4 sm:px-4 sm:pb-20 sm:pt-8 lg:px-6">
      <FloatingQuote />
      <QualityTracker />
      <HistoryButton />
    </main>
  );
}
