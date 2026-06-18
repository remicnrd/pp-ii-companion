import DayClientV2 from "./DayClientV2";

// Static export: pre-render all 20 days (mirrors v1).
export function generateStaticParams() {
  return Array.from({ length: 20 }, (_, i) => ({ day: String(i + 1) }));
}

export default function V2DayPage({ params }: { params: Promise<{ day: string }> }) {
  return <DayClientV2 params={params} />;
}
