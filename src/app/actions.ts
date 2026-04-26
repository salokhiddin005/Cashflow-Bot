"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCategory,
  createTransaction,
  deleteCategory,
  deleteTransaction,
  updateCategory,
  updateTransaction,
  updateWorkspace,
} from "@/lib/db/queries";
import { publish } from "@/lib/events";

const txInput = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.coerce.number().int().positive(),
  category_id: z.coerce.number().int().positive(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

export async function addTransactionAction(formData: FormData) {
  const parsed = txInput.parse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    category_id: formData.get("category_id"),
    occurred_on: formData.get("occurred_on"),
    note: formData.get("note") || null,
  });
  createTransaction({ ...parsed, source: "web" });
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/analytics");
  publish("transaction:created", { source: "web" });
}

export async function updateTransactionAction(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const parsed = txInput.parse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    category_id: formData.get("category_id"),
    occurred_on: formData.get("occurred_on"),
    note: formData.get("note") || null,
  });
  updateTransaction(id, parsed);
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/analytics");
  publish("transaction:updated", { source: "web", payload: { id } });
}

export async function deleteTransactionAction(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  deleteTransaction(id);
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/analytics");
  publish("transaction:deleted", { source: "web", payload: { id } });
}

const catInput = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, "use snake_case (lowercase + underscores)").max(40),
  kind: z.enum(["income", "expense"]),
  label_uz: z.string().min(1).max(40),
  label_ru: z.string().min(1).max(40),
  label_en: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(40).optional(),
});

export async function addCategoryAction(formData: FormData) {
  const parsed = catInput.parse({
    key: formData.get("key"),
    kind: formData.get("kind"),
    label_uz: formData.get("label_uz"),
    label_ru: formData.get("label_ru"),
    label_en: formData.get("label_en"),
    color: formData.get("color") || undefined,
    icon: formData.get("icon") || undefined,
  });
  createCategory(parsed);
  revalidatePath("/categories");
  revalidatePath("/");
  revalidatePath("/transactions");
  publish("category:changed", { source: "web" });
}

export async function updateCategoryAction(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const patch = z
    .object({
      label_uz: z.string().min(1).max(40),
      label_ru: z.string().min(1).max(40),
      label_en: z.string().min(1).max(40),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      icon: z.string().max(40),
    })
    .parse({
      label_uz: formData.get("label_uz"),
      label_ru: formData.get("label_ru"),
      label_en: formData.get("label_en"),
      color: formData.get("color"),
      icon: formData.get("icon"),
    });
  updateCategory(id, patch);
  revalidatePath("/categories");
  publish("category:changed", { source: "web" });
}

export async function archiveCategoryAction(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const archived = formData.get("archived") === "1";
  updateCategory(id, { is_archived: archived ? 1 : 0 });
  revalidatePath("/categories");
  publish("category:changed", { source: "web" });
}

export async function deleteCategoryAction(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  deleteCategory(id);
  revalidatePath("/categories");
  publish("category:changed", { source: "web" });
}

export async function updateWorkspaceAction(formData: FormData) {
  const parsed = z
    .object({
      name: z.string().min(1).max(80),
      starting_balance: z.coerce.number().int().min(0),
      starting_balance_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .parse({
      name: formData.get("name"),
      starting_balance: formData.get("starting_balance"),
      starting_balance_at: formData.get("starting_balance_at"),
    });
  updateWorkspace(parsed);
  revalidatePath("/");
  revalidatePath("/categories");
  publish("workspace:changed", { source: "web" });
}
