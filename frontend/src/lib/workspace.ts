import { GraphQLClient } from "graphql-request";
import { createGraphQLClient } from "@/lib/graphql";

export async function queryGraphQL<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
  const client: GraphQLClient = createGraphQLClient();
  return client.request<T>(document, variables);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const graphMessage = error.message.match(/"message":"([^"]+)"/)?.[1];
    return graphMessage ?? error.message.replace(/^GraphQL Error \(Code: \d+\):\s*/, "");
  }
  return "La operación no pudo completarse.";
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