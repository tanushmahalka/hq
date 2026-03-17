export type ChatImageUploadResponse = {
  url: string;
  key: string;
  contentType: string;
  size: number;
};

export async function uploadChatImage(
  file: File,
): Promise<ChatImageUploadResponse> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/chat/uploads/image", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const data = (await response.json().catch(() => ({}))) as
    | ChatImageUploadResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      "message" in data && typeof data.message === "string"
        ? data.message
        : "Image upload failed",
    );
  }

  return data as ChatImageUploadResponse;
}
