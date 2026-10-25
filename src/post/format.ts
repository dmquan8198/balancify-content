/** Issue messages end with "."; drop it before joining so the line has no ".;". */
export const joinMessages = (messages: string[]) => messages.map((m) => m.replace(/\.\s*$/, "")).join("; ");

export const NAME_FALLBACK_NOTE = " (tên colorway đổi sang trắng vì màu túi không đủ tương phản)";

/** The one-line verdict shared by the post CLI and review.md. */
export const verdictLine = (ok: boolean, warnings: number) =>
  !ok ? "KẾT QUẢ: CÓ LỖI" : warnings > 0 ? `KẾT QUẢ: ĐẠT (${warnings} cảnh báo — xem mục Cảnh báo)` : "KẾT QUẢ: ĐẠT";
