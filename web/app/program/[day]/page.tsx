import DayClient from "./DayClient";

// Static export: pre-render all 20 days at build time.
export function generateStaticParams() {
  return Array.from({ length: 20 }, (_, i) => ({
    day: String(i + 1),
  }));
}

export default function DayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  return <DayClient params={params} />;
}
