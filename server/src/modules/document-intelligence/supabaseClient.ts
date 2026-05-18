interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

export class SupabaseRestClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceRoleKey: string,
  ) {}

  async from<T>(table: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`/rest/v1/${table}`, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(options.headers ?? {}),
      },
      body: options.body == null ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed for ${table} with status ${response.status}`);
    }

    if (response.status === 204) {
      return [] as T;
    }

    return (await response.json()) as T;
  }

  async uploadObject(bucket: string, objectPath: string, body: string | Uint8Array, contentType: string): Promise<void> {
    const url = new URL(`/storage/v1/object/${bucket}/${objectPath}`, this.baseUrl);
    let binaryBody: Uint8Array<ArrayBuffer> | null = null;
    if (typeof body !== "string") {
      const arrayBuffer = new ArrayBuffer(body.byteLength);
      binaryBody = new Uint8Array(arrayBuffer);
      binaryBody.set(body);
    }
    const requestBody =
      typeof body === "string"
        ? body
        : binaryBody!;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`Supabase storage upload failed with status ${response.status}`);
    }
  }

  async downloadObject(bucket: string, objectPath: string): Promise<string | null> {
    const url = new URL(`/storage/v1/object/${bucket}/${objectPath}`, this.baseUrl);
    const response = await fetch(url, {
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Supabase storage download failed with status ${response.status}`);
    }

    return await response.text();
  }
}
