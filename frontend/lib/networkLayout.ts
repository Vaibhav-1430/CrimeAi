import type { Edge, Node } from "@xyflow/react";
import type { NetworkGraph, NetworkNodeType } from "@/types/network";

export const NODE_STYLES: Record<NetworkNodeType, { color: string; label: string }> = {
  suspect: { color: "#dc2626", label: "Suspect" },
  fir: { color: "#0d9488", label: "FIR" },
  witness: { color: "#2563eb", label: "Witness" },
  evidence: { color: "#9333ea", label: "Evidence" },
  station: { color: "#ca8a04", label: "Station" }
};

const EDGE_COLOR: Record<string, string> = {
  co_accused: "#dc2626",
  accused_in: "#f87171",
  witnessed: "#3b82f6",
  evidence_of: "#a855f7",
  filed_at: "#a16207"
};

/**
 * Position nodes deterministically in concentric rings by type — suspects in
 * the center (the focus of network analysis), then FIRs, then the rest. React
 * Flow lets the user drag from there.
 */
export function toReactFlow(graph: NetworkGraph): { nodes: Node[]; edges: Edge[] } {
  const ringOrder: NetworkNodeType[] = ["suspect", "fir", "station", "witness", "evidence"];
  const ringRadius: Record<NetworkNodeType, number> = {
    suspect: 0,
    fir: 320,
    station: 560,
    witness: 720,
    evidence: 860
  };

  const byType = new Map<NetworkNodeType, typeof graph.nodes>();
  for (const node of graph.nodes) {
    const list = byType.get(node.type) ?? [];
    list.push(node);
    byType.set(node.type, list);
  }

  const nodes: Node[] = [];
  for (const type of ringOrder) {
    const list = byType.get(type) ?? [];
    const radius = ringRadius[type];
    list.forEach((node, index) => {
      const angle = (index / Math.max(list.length, 1)) * Math.PI * 2;
      const isCenter = radius === 0;
      // Spread the central suspects on a small spiral so they don't overlap.
      const r = isCenter ? 12 * Math.sqrt(index) * 6 : radius;
      const style = NODE_STYLES[type];
      nodes.push({
        id: node.id,
        position: { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
        data: { label: node.label, nodeType: node.type, meta: node.meta },
        style: {
          background: style.color,
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: type === "suspect" ? 999 : 6,
          fontSize: 11,
          padding: "6px 10px",
          width: "auto",
          maxWidth: 160
        }
      });
    });
  }

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    style: {
      stroke: EDGE_COLOR[edge.type] ?? "#52525b",
      strokeWidth: edge.type === "co_accused" ? 2 : 1
    },
    animated: edge.type === "co_accused"
  }));

  return { nodes, edges };
}
