import { GraphQLClient } from "graphql-request";
import { readSession } from "@/lib/auth";

// Endpoint dinámico y absoluto para evitar el error del constructor de URL
const getEndpoint = () => {
  if (typeof window !== "undefined") {
    return window.location.origin + "/api/graphql";
  }
  return process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/api/graphql";
};

export function createGraphQLClient(token = readSession()?.token): GraphQLClient {
  return new GraphQLClient(getEndpoint(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
    }
  }
`;