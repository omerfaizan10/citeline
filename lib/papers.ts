import type { Paper } from "./types";

export function groupByTopic(papers: Paper[]): [string, Paper[]][] {
  const groups = new Map<string, Paper[]>();
  for (const paper of papers) {
    const list = groups.get(paper.topic) ?? [];
    list.push(paper);
    groups.set(paper.topic, list);
  }
  return Array.from(groups.entries());
}
