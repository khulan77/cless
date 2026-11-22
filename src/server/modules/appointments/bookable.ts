/**
 * Календарьт үйлчилгээ хийх ажилтнаар сонгогдох эсэх (User.isBookable)-ийн дүрэм — цэвэр.
 * Шинэ STAFF → автоматаар true; MANAGER/ADMIN → false (ADMIN хуваарийн хуудаснаас гараар асаана).
 */
import type { Role } from "@/generated/prisma/enums";

export function defaultBookable(role: Role): boolean {
  return role === "STAFF";
}

/**
 * Хэрэглэгч засахад: эрх өөрчлөгдөөгүй бол одоогийн утгыг (гараар тохируулсныг) хадгална,
 * өөрчлөгдсөн бол шинэ эрхийн default.
 */
export function bookableAfterRoleChange(before: { role: Role; isBookable: boolean }, nextRole: Role): boolean {
  return before.role === nextRole ? before.isBookable : defaultBookable(nextRole);
}
