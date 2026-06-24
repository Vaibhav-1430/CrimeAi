"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect } from "react";
import { NODE_STYLES, toReactFlow } from "@/lib/networkLayout";
import type { NetworkGraph, NetworkNodeType } from "@/types/network";

interface NetworkGraphCanvasProps {
  graph: NetworkGraph;
  onSelectNode?: (node: Node | null) => void;
}

export default function NetworkGraphCanvas({ graph, onSelectNode }: NetworkGraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const { nodes: flowNodes, edges: flowEdges } = toReactFlow(graph);
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graph, setNodes, setEdges]);

  return (
    <div className="h-[calc(100vh-220px)] min-h-[480px] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectNode?.(node)}
        onPaneClick={() => onSelectNode?.(null)}
        fitView
        minZoom={0.05}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background color="#27272a" gap={20} />
        <Controls className="!bg-zinc-900 !border-zinc-700" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) =>
            NODE_STYLES[(node.data?.nodeType as NetworkNodeType) ?? "fir"].color
          }
          maskColor="rgba(9,9,11,0.7)"
          className="!bg-zinc-900"
        />
      </ReactFlow>
    </div>
  );
}
