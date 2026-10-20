import FloatingQuote from "@/components/FloatingQuote";
import QualityTracker from "@/sections/QualityTracker";

export default function Home(): React.JSX.Element {
  return (
    <main className="home-main mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 pb-12 pt-3 sm:px-4 sm:pb-16 sm:pt-4 lg:px-6">
      <QualityTracker />
      <FloatingQuote />
    </main>
  );
}
