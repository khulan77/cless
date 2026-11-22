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
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/products/[slug]", "page");
}

export async function saveCollection(input: CollectionInput) {
  return runAction(async () => {
    const user = await requirePermission("product:write");
    const data = parseInput(collectionInputSchema, input);
    const fields = {
      name: data.name,
      slug: data.slug,
      kind: data.kind,
      parentId: data.parentId,
      heading: data.heading,
      intro: data.intro,
      seoText: data.seoText,
      bannerImage: data.bannerImage,
      tileImage: data.tileImage,
      showInMenu: data.showInMenu,
      sortOrder: data.sortOrder,
      showOnHome: data.showOnHome,
    };
    const removedImages: string[] = [];

    const id = await db.$transaction(async (tx) => {
      const before = data.id ? await tx.collection.findUnique({ where: { id: data.id } }) : null;
      if (data.id && !before) throw new UserError("Ангилал олдсонгүй.");
      const slugOwner = await tx.collection.findUnique({ where: { slug: data.slug }, select: { id: true } });
      if (slugOwner && slugOwner.id !== data.id) {
        throw new UserError("Энэ slug өөр ангилалд ашиглагдсан байна.", { slug: ["Slug давхардсан."] });
      }
      // Эцэг ангилал: ижил төрөл, мөчлөггүй (өөрийнх нь удамд байж болохгүй), 3 түвшнээс гүнгүй
      if (data.parentId) {
        let cursor: string | null = data.parentId;
        let depth = 0;
        while (cursor) {
          if (cursor === data.id) throw new UserError("Ангиллыг өөрийнх нь дэд ангилалд хийх боломжгүй.", { parentId: ["Мөчлөг үүснэ."] });
          const node: { parentId: string | null; kind: string } | null = await tx.collection.findUnique({
            where: { id: cursor },
            select: { parentId: true, kind: true },
          });
          if (!node) throw new UserError("Эцэг ангилал олдсонгүй.", { parentId: ["Олдсонгүй."] });
          if (depth === 0 && node.kind !== data.kind) throw new UserError("Эцэг ангилал ижил төрөлтэй байх ёстой.", { parentId: ["Төрөл зөрүүтэй."] });
          cursor = node.parentId;
          if (++depth > 2) throw new UserError("Ангилал 3 түвшнээс гүн байж болохгүй.", { parentId: ["Хэт гүн."] });
        }
      }

      const saved = before
        ? await tx.collection.update({ where: { id: before.id }, data: fields })
        : await tx.collection.create({ data: fields });
      for (const k of ["bannerImage", "tileImage"] as const) {
        if (before?.[k] && before[k] !== data[k]) removedImages.push(before[k]!);
      }

      // Ангилал доторх бүтээгдэхүүний дараалал
      for (const [position, productId] of data.productOrder.entries()) {
        await tx.productCollection.updateMany({ where: { collectionId: saved.id, productId }, data: { position } });
      }

      // Редакцийн нүднүүд
      const beforeTiles = await tx.collectionTile.findMany({ where: { collectionId: saved.id } });
      const keep = data.tiles.flatMap((t) => (t.id ? [t.id] : []));
      for (const t of beforeTiles) if (!keep.includes(t.id) && !data.tiles.some((x) => x.image === t.image)) removedImages.push(t.image);
      await tx.collectionTile.deleteMany({ where: { collectionId: saved.id, id: { notIn: keep } } });
      for (const { id: tileId, ...tile } of data.tiles) {
        if (tileId) await tx.collectionTile.updateMany({ where: { id: tileId, collectionId: saved.id }, data: tile });
        else await tx.collectionTile.create({ data: { ...tile, collectionId: saved.id } });
      }

      await audit(tx, {
        userId: user.id,
        action: before ? "collection.update" : "collection.create",
        entity: "Collection",
        entityId: saved.id,
        before: before && { ...before, tiles: beforeTiles },
        after: { ...fields, productOrder: data.productOrder, tiles: data.tiles },
      });
      return saved.id;
    }, { maxWait: 10_000, timeout: 30_000 });

    await Promise.all(removedImages.map((u) => storage.remove(u)));
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
        include: { _count: { select: { products: true, commissionRules: true, children: true } } },
      });
      if (!c) throw new UserError("Ангилал олдсонгүй.");
      if (c._count.products > 0) {
        throw new UserError(`${c._count.products} бүтээгдэхүүнд холбогдсон тул устгах боломжгүй. Эхлээд бүтээгдэхүүнээс салгана уу.`);
      }
      if (c._count.children > 0) throw new UserError("Дэд ангилалтай тул устгах боломжгүй. Эхлээд дэд ангиллуудыг шилжүүлнэ үү.");
      if (c._count.commissionRules > 0) throw new UserError("Урамшууллын дүрэмд ашиглагдаж байгаа тул устгах боломжгүй.");
      await tx.collection.delete({ where: { id } });
      await audit(tx, { userId: user.id, action: "collection.delete", entity: "Collection", entityId: id, before: c });
    });
    refresh();
  }, "Ангилал устгагдлаа.");
}
