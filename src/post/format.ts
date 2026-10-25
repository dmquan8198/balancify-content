/** Issue messages end with "."; drop it before joining so the line has no ".;". */
export const joinMessages = (messages: string[]) => messages.map((m) => m.replace(/\.\s*$/, "")).join("; ");

export const NAME_FALLBACK_NOTE = " (tên colorway đổi sang trắng vì màu túi không đủ tương phản)";
