import { flattenCategories } from "./categories";

describe("flattenCategories", () => {
  it("keeps parent/child order from the API tree", () => {
    const flat = flattenCategories([
      {
        id: "parent",
        parentId: null,
        slug: "parent",
        name: "Parent",
        appliesTo: "PROFESSIONAL",
        isActive: true,
        sortOrder: 1,
        children: [
          {
            id: "child",
            parentId: "parent",
            slug: "child",
            name: "Child",
            appliesTo: "PROFESSIONAL",
            isActive: true,
            sortOrder: 1,
            children: [],
          },
        ],
      },
    ]);
    expect(flat.map((node) => node.id)).toEqual(["parent", "child"]);
    expect(flat[1]?.depth).toBe(1);
  });
});
