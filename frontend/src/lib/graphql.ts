import { GraphQLClient } from "graphql-request";
import { readSession } from "@/lib/auth";

// Endpoint dinámico y absoluto para evitar el error del constructor de URL
const getEndpoint = () => {
  if (typeof window !== "undefined") {
    return window.location.origin + "/api/graphql";
  }
  return process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/api/graphql";
};

export function createGraphQLClient(token?: string): GraphQLClient {
  let resolvedToken = token;
  
  if (!resolvedToken && typeof window !== "undefined") {
    // Intenta leerlo de readSession() o directamente de localStorage como respaldo seguro
    const sessionData = readSession();
    resolvedToken = sessionData?.token || localStorage.getItem("token") || "";
  }

  return new GraphQLClient(getEndpoint(), {
    headers: resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {},
  });
}

export const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
    }
  }
`;