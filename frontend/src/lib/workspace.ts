import { ClientError, GraphQLClient } from "graphql-request";
import { createGraphQLClient } from "@/lib/graphql";
import { GENERIC_ERROR_MESSAGE } from "@/lib/localization";
import { clearSession } from "@/lib/auth";

class GraphQLAuthorizationError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = "GraphQLAuthorizationError";
  }
}

export async function queryGraphQL<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
  const client: GraphQLClient = createGraphQLClient();
  try {
    return await client.request<T>(document, variables);
  } catch (error) {
    const authorizationFailure = getAuthorizationFailure(error);
    if (authorizationFailure === "unauthenticated" && typeof window !== "undefined") {
      clearSession();
      window.location.replace("/login");
    }
    if (authorizationFailure) {
      throw new GraphQLAuthorizationError(
        authorizationFailure === "unauthenticated"
          ? "Tu sesión venció. Inicia sesión nuevamente."
          : "No tienes permisos para realizar esta operación.",
        error,
      );
    }
    throw error;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof GraphQLAuthorizationError) return error.message;
  return GENERIC_ERROR_MESSAGE;
}

function getAuthorizationFailure(error: unknown): "unauthenticated" | "forbidden" | null {
  if (!(error instanceof ClientError)) return null;

  if (error.response.status === 401) return "unauthenticated";
  if (error.response.status === 403) return "forbidden";

  for (const graphQLError of error.response.errors ?? []) {
    const classification = graphQLError.extensions?.classification;
    const code = graphQLError.extensions?.code;
    const identifiers = [classification, code]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toUpperCase());
    if (identifiers.some((value) => ["UNAUTHORIZED", "UNAUTHENTICATED"].includes(value))) {
      return "unauthenticated";
    }
    if (identifiers.some((value) => ["FORBIDDEN", "ACCESS_DENIED"].includes(value))) {
      return "forbidden";
    }
  }

  return null;
}

export type AssetItem = {
  id: string;
  serialNumber: string;
  model: string | null;
  estimatedValue: number | null;
  status: string;
  purchaseDate: string | null;
};

export type UserItem = {
  id: string;
  fullName: string | null;
  email: string;
  role: "ADMIN" | "INSPECTOR" | "TECHNICIAN";
  status: boolean;
};

export type LoanItem = {
  id: string;
  requestDate: string | null;
  dueLocalDate: string | null;
  returnDateTime: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED";
  returnCondition: "GOOD" | "DAMAGED" | "LOST" | null;
  delayDays: number | null;
  rejectionReason: string | null;
  user?: Pick<UserItem, "id" | "fullName" | "email"> | null;
  inspector?: Pick<UserItem, "id" | "fullName"> | null;
  asset: Pick<AssetItem, "id" | "serialNumber" | "model" | "estimatedValue" | "status">;
};

export type MaintenanceItem = {
  id: string;
  providerName: string | null;
  reason: string | null;
  cost: number | null;
  startDate: string | null;
  endDate: string | null;
  asset: Pick<AssetItem, "id" | "serialNumber" | "model" | "status">;
};