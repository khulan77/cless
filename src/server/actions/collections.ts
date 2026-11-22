"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requirePermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import { storage } from "@/server/storage";
import { collectionInputSchema, type CollectionInput } from "@/lib/validation/collection";
import { idSchema } from "@/lib/validation/common";
import { parseInput, runAction } from "./result";

function refresh() {
  updateTag("catalog");
  revalidatePath("/");
}

export async function saveCollection(input: CollectionInput) {
  return runAction(async () => {
    const user = await requirePermission("product:write");
    const data = parseInput(collectionInputSchema, input);
    const fields = {
      name: data.name,
      slug: data.slug,
      kind: data.kind,
      description: data.description,
      image: data.image,
      navGroup: data.navGroup,
      sortOrder: data.sortOrder,
      showOnHome: data.showOnHome,
    };
    let removedImage: string | null = null;

    const id = await db.$transaction(async (tx) => {
      const before = data.id ? await tx.collection.findUnique({ where: { id: data.id } }) : null;
      if (data.id && !before) throw new UserError("Ангилал олдсонгүй.");
      const slugOwner = await tx.collection.findUnique({ where: { slug: data.slug }, select: { id: true } });
      if (slugOwner && slugOwner.id !== data.id) {
        throw new UserError("Энэ slug өөр ангилалд ашиглагдсан байна.", { slug: ["Slug давхардсан."] });
      }
      const saved = before
        ? await tx.collection.update({ where: { id: before.id }, data: fields })
        : await tx.collection.create({ data: fields });
      if (before?.image && before.image !== data.image) removedImage = before.image;
      await audit(tx, {
        userId: user.id,
        action: before ? "collection.update" : "collection.create",
        entity: "Collection",
        entityId: saved.id,
        before,
        after: fields,
      });
      return saved.id;
    });

    if (removedImage) await storage.remove(removedImage);
    refresh();
    return { id };
  }, "Ангилал хадгалагдлаа.");
}

/** Зөвхөн ашиглагдаагүй ангиллыг устгана (борлуулалттай холбоогүй). */
export async function deleteCollection(rawId: string) {
  return runAction(async () => {
    const user = await requirePermission("product:write");
    const id = idSchema.parse(rawId);
    await db.$transaction(async (tx) => {
      const c = await tx.collection.findUnique({
        where: { id },
        include: { _count: { select: { products: true, commissionRules: true } } },
      });
      if (!c) throw new UserError("Ангилал олдсонгүй.");
      if (c._count.products > 0) {
        throw new UserError(`${c._count.products} бүтээгдэхүүнд холбогдсон тул устгах боломжгүй. Эхлээд бүтээгдэхүүнээс салгана уу.`);
      }
      if (c._count.commissionRules > 0) throw new UserError("Урамшууллын дүрэмд ашиглагдаж байгаа тул устгах боломжгүй.");
      await tx.collection.delete({ where: { id } });
      await audit(tx, { userId: user.id, action: "collection.delete", entity: "Collection", entityId: id, before: c });
    });
    refresh();
  }, "Ангилал устгагдлаа.");
}
