import { CategoryManager } from "../../components/category-manager";

export default function CategoriesPage() {
  return (
    <main>
      <h1>Categories</h1>
      <p className="lede">
        Admin CRUD for the live category tree. Names and slugs are stored in the database and served
        to member apps over the API.
      </p>
      <CategoryManager />
    </main>
  );
}
