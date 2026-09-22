import AppShell from "@/components/AppShell";
import papers from "@/data/papers.json";

export default function Home() {
  return <AppShell papers={papers} />;
}
