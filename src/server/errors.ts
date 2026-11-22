/** Хэрэглэгчид шууд харуулж болох алдаа (Монгол мессежтэй) */
export class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "UserError";
  }
}

export class ForbiddenError extends Error {
  status = 403 as const;
  constructor(message = "Энэ үйлдлийг хийх эрх танд байхгүй байна.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  status = 401 as const;
  constructor(message = "Нэвтрэх шаардлагатай.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
