import { AdminShell } from "../../components/admin-shell";
import { CategoryManager } from "../../components/category-manager";

export default function CategoriesPage() {
  return (
    <AdminShell
      section="categories"
      title="Categories"
      lede="Admin CRUD for the live category tree. Names and slugs are stored in the database and served to member apps over the API."
    >
      <CategoryManager />
    </AdminShell>
  );
}
