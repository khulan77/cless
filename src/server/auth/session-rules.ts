/** Session хүчинтэй эсэх — цэвэр дүрэм (session.ts, тест) */
export function isSessionValid(user: { isActive: boolean; passwordChangedAt: Date | null } | null, tokenPwdAt: number | undefined): boolean {
  if (!user || !user.isActive) return false;
  // Нууц үг солигдсоноос өмнө олгосон session — хүчингүй (бусад төхөөрөмжөөс ч гарна)
  return (user.passwordChangedAt?.getTime() ?? 0) <= (tokenPwdAt ?? 0);
}
