import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui";
import { CategoryManager } from "@/components/category-manager";
import { WorkspaceForm } from "@/components/workspace-form";
import { getWorkspace, listCategories } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CategoriesPage() {
  const [categories, workspace] = await Promise.all([
    listCategories({ includeArchived: true }),
    getWorkspace(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle="Manage how income and expenses are grouped. The Telegram bot uses these labels to pick a category."
      />

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Workspace</div>
          <div className="mt-0.5 text-[12px] text-[--color-muted]">
            Set your business name and the starting cash balance — used to compute the cash position and runway.
          </div>
        </CardHeader>
        <CardBody>
          <WorkspaceForm workspace={workspace} />
        </CardBody>
      </Card>

      <CategoryManager categories={categories} />
    </div>
  );
}
