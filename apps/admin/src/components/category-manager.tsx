"use client";

import { HasutApiError } from "@hasut/api-client";
import type { CategoryAppliesTo, CategoryView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { flattenCategories } from "../lib/categories";
import { adminTokenStorage } from "../lib/token-storage";

const APPLIES_TO: CategoryAppliesTo[] = ["ALL", "PROFESSIONAL", "BUSINESS", "SERVICE"];

interface CategoryForm {
  name: string;
  slug: string;
  parentId: string;
  appliesTo: CategoryAppliesTo;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm: CategoryForm = {
  name: "",
  slug: "",
  parentId: "",
  appliesTo: "ALL",
  sortOrder: 100,
  isActive: true,
};

export function CategoryManager() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading categories from the API…");
  const [tree, setTree] = useState<CategoryView[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const load = useCallback(async () => {
    const token = await adminTokenStorage.getAccessToken();
    if (token === null) {
      window.location.assign("/login");
      return;
    }
    setState("loading");
    try {
      const me = await createAdminApiClient().me();
      if (!me.roles.includes("ADMIN")) {
        setState("error");
        setMessage("This account is not an admin.");
        return;
      }
      const categories = await createAdminApiClient().listAdminCategories();
      setTree(categories);
      setState(categories.length === 0 ? "empty" : "success");
      setMessage(
        categories.length === 0
          ? "No categories yet. Create the first parent category."
          : "Categories are stored in the database. Create parents, then children.",
      );
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        window.location.assign("/login");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load categories.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flat = useMemo(() => flattenCategories(tree), [tree]);

  async function save(): Promise<void> {
    setState("loading");
    try {
      const payload = {
        name: form.name,
        slug: form.slug.length > 0 ? form.slug : undefined,
        parentId: form.parentId.length > 0 ? form.parentId : null,
        appliesTo: form.appliesTo,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      const client = createAdminApiClient();
      if (editingId === null) {
        await client.createCategory(payload);
      } else {
        await client.patchCategory(editingId, payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to save the category.");
    }
  }

  async function remove(categoryId: string): Promise<void> {
    setState("loading");
    try {
      await createAdminApiClient().deleteCategory(categoryId);
      if (editingId === categoryId) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await load();
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to delete the category.");
    }
  }

  function edit(node: CategoryView): void {
    setEditingId(node.id);
    setForm({
      name: node.name,
      slug: node.slug,
      parentId: node.parentId ?? "",
      appliesTo: node.appliesTo,
      sortOrder: node.sortOrder,
      isActive: node.isActive,
    });
  }

  return (
    <Surface state={state} title="Categories">
      <p>{message}</p>
      <ul className="category-list">
        {flat.map((node) => (
          <li key={node.id} style={{ marginLeft: node.depth * 16 }}>
            <strong>{node.name}</strong>{" "}
            <span className="hint">
              {node.slug} · {node.appliesTo}
              {node.isActive ? "" : " · inactive"}
            </span>
            <div className="actions">
              <Button type="button" variant="secondary" onClick={() => edit(node)}>
                Edit
              </Button>
              <Button type="button" variant="secondary" onClick={() => void remove(node.id)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h3>{editingId === null ? "Create category" : "Edit category"}</h3>
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </label>
        <label>
          Slug
          <input
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="Generated from the name when empty"
          />
        </label>
        <label>
          Parent
          <select
            value={form.parentId}
            onChange={(event) =>
              setForm((current) => ({ ...current, parentId: event.target.value }))
            }
          >
            <option value="">None</option>
            {flat
              .filter((node) => node.id !== editingId)
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {"- ".repeat(node.depth)}
                  {node.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Applies to
          <select
            value={form.appliesTo}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                appliesTo: event.target.value as CategoryAppliesTo,
              }))
            }
          >
            {APPLIES_TO.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort order
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(event) =>
              setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))
            }
          />
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.target.checked }))
            }
          />
          Active
        </label>
        <div className="actions">
          <Button type="submit">{editingId === null ? "Create" : "Save"}</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
            }}
          >
            Clear
          </Button>
        </div>
      </form>
    </Surface>
  );
}
