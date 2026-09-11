import type { CategoryView } from "@hasut/types";

export function flattenCategories(
  nodes: CategoryView[],
  depth = 0,
): Array<CategoryView & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}
