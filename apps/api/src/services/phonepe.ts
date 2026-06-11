import { nanoid } from "nanoid";

type PhonePeEnv = "production" | "sandbox";

interface PhonePeConfig {
  mock: boolean;
  env: PhonePeEnv;
  merchantId: string;
  clientId: string;
  clientSecret: string;
  clientVersion: string;
}

interface CreatePaymentInput {
  merchantOrderId: string;
  amountPaisa: number;
  redirectUrl: string;
  metaInfo?: Record<string, string>;
}

interface CreatePaymentResult {
  orderId: string;
  redirectUrl: string;
  state: string;
}

interface OrderStatusResult {
  orderId?: string;
  state: "PENDING" | "COMPLETED" | "FAILED" | string;
  amount?: number;
  code?: string;
  message?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function getConfig(): PhonePeConfig {
  return {
    mock: process.env.PHONEPE_MOCK === "true",
    env: process.env.PHONEPE_ENV === "production" ? "production" : "sandbox",
    merchantId: process.env.PHONEPE_MERCHANT_ID ?? "",
    clientId: process.env.PHONEPE_CLIENT_ID ?? "",
    clientSecret: process.env.PHONEPE_CLIENT_SECRET ?? "",
    clientVersion: process.env.PHONEPE_CLIENT_VERSION ?? "1",
  };
}

function getBaseUrls(env: PhonePeEnv) {
  if (env === "production") {
    return {
      auth: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
      pay: "https://api.phonepe.com/apis/pg/checkout/v2/pay",
      status: (orderId: string) =>
        `https://api.phonepe.com/apis/pg/checkout/v2/order/${orderId}/status?details=false`,
    };
  }
  return {
    auth: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
    pay: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
    status: (orderId: string) =>
      `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${orderId}/status?details=false`,
  };
}

export function createMerchantOrderId(userId: string): string {
  const suffix = nanoid(12).replace(/[^a-zA-Z0-9_-]/g, "");
  return `nior-${userId.slice(-8)}-${suffix}`.slice(0, 63);
}

async function getAccessToken(config: PhonePeConfig): Promise<string> {
  if (config.mock) return "mock-token";

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const urls = getBaseUrls(config.env);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    client_version: config.clientVersion,
    grant_type: "client_credentials",
  });

  const res = await fetch(urls.auth, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PhonePe auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_at?: number;
    expires_in?: number;
  };

  const expiresAt =
    data.expires_at != null
      ? data.expires_at * 1000
      : Date.now() + (data.expires_in ?? 3600) * 1000;

  cachedToken = { token: data.access_token, expiresAt };
  return data.access_token;
}

export async function createPhonePePayment(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  const config = getConfig();

  if (config.mock) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    return {
      orderId: `MOCK-${input.merchantOrderId}`,
      state: "PENDING",
      redirectUrl: `${appUrl}/dashboard/billing/success?orderId=${encodeURIComponent(input.merchantOrderId)}&mock=1`,
    };
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error("PhonePe credentials are not configured");
  }

  const token = await getAccessToken(config);
  const urls = getBaseUrls(config.env);

  const payload = {
    merchantOrderId: input.merchantOrderId,
    amount: input.amountPaisa,
    expireAfter: 1800,
    metaInfo: input.metaInfo,
    paymentFlow: {
      type: "PG_CHECKOUT",
      message: "Nior subscription payment",
      merchantUrls: {
        redirectUrl: input.redirectUrl,
      },
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `O-Bearer ${token}`,
  };

  if (config.merchantId) {
    headers["X-MERCHANT-ID"] = config.merchantId;
  }

  const res = await fetch(urls.pay, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as CreatePaymentResult & {
    code?: string;
    message?: string;
  };

  if (!res.ok || !data.redirectUrl) {
    throw new Error(
      data.message ?? data.code ?? `PhonePe payment failed (${res.status})`
    );
  }

  return data;
}

export async function getPhonePeOrderStatus(
  merchantOrderId: string
): Promise<OrderStatusResult> {
  const config = getConfig();

  if (config.mock) {
    return { state: "COMPLETED", orderId: `MOCK-${merchantOrderId}` };
  }

  const token = await getAccessToken(config);
  const urls = getBaseUrls(config.env);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `O-Bearer ${token}`,
  };

  if (config.merchantId) {
    headers["X-MERCHANT-ID"] = config.merchantId;
  }

  const res = await fetch(urls.status(merchantOrderId), { headers });
  const data = (await res.json()) as OrderStatusResult;

  if (!res.ok) {
    throw new Error(data.message ?? `PhonePe status check failed (${res.status})`);
  }

  return data;
}
